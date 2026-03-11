from firebase_functions import scheduler_fn, https_fn, firestore_fn
from firebase_admin import initialize_app, firestore

from demand_calc import calc_demand_for_train_sets
from boarding_sim import run_boarding_tick, rebuild_schedule_table, rebuild_schedule_for_trainset

initialize_app()


@scheduler_fn.on_schedule(schedule='0 3 * * *', timezone='Europe/Warsaw')
def calc_daily_demand(event: scheduler_fn.ScheduledEvent) -> None:
    """Cloud Function: compute daily passenger demand for all trainSets.

    Runs at 03:00 Warsaw time. Recalculates dailyDemand via multinomial logit
    and resets dailyTransfer / currentTransfer for the new day.
    """
    db = firestore.client()
    calc_demand_for_train_sets(db)


@scheduler_fn.on_schedule(schedule='* * * * *', timezone='Europe/Warsaw')
def tick_boarding(event: scheduler_fn.ScheduledEvent) -> None:
    """Cloud Function: simulate train boarding at each scheduled stop.

    Runs every minute. For every kurs stop whose odjazd matches the current
    HH:MM, processes alighting + boarding and updates:
      - dailyDemand  (remaining waiting passengers)
      - dailyTransfer (passengers transported so far today)
      - currentTransfer (live on-board state per kurs)
    """
    db = firestore.client()
    run_boarding_tick(db)


@firestore_fn.on_document_written(document='players/{pid}/trainSet/{ts_id}')
def on_trainset_written(
    event: firestore_fn.Event[firestore_fn.Change],
) -> None:
    """Firestore trigger: rebuild rozkłady records when a trainSet is saved or deleted.

    Fires on every create / update / delete of a trainSet document so the
    flat schedule table is always in sync without any frontend changes.
    """
    pid   = event.params['pid']
    ts_id = event.params['ts_id']

    # event.data.after is None when the document was deleted
    ts_data = event.data.after.to_dict() if event.data.after else None

    db = firestore.client()
    rebuild_schedule_for_trainset(db, pid, ts_id, ts_data)


@https_fn.on_request()
def rebuild_schedule(req: https_fn.Request) -> https_fn.Response:
    """HTTP trigger: rebuild the flat rozkłady schedule table.

    Call after saving a new trainSet rozklad to keep the table in sync.
    """
    db      = firestore.client()
    written = rebuild_schedule_table(db)
    return https_fn.Response(f'Schedule table rebuilt: {written} records.\n', status=200)


@https_fn.on_request()
def calc_demand_manual(req: https_fn.Request) -> https_fn.Response:
    """HTTP trigger: manually run daily demand calculation (for testing / bootstrap)."""
    db = firestore.client()
    updated = calc_demand_for_train_sets(db)
    return https_fn.Response(f'Demand calculated: {updated} trainSet(s) updated.\n', status=200)


@https_fn.on_request()
def boarding_tick_manual(req: https_fn.Request) -> https_fn.Response:
    """HTTP trigger for manual boarding tick (testing / backfill).

    Optional query param: ?time=HH:MM to simulate a specific minute.
    Example: /boarding_tick_manual?time=07:15
    """
    now_str = req.args.get('time') or None
    db = firestore.client()
    count = run_boarding_tick(db, now_str=now_str)
    return https_fn.Response(
        f'Boarding tick processed {count} stop event(s) at {now_str or "now"}.\n',
        status=200,
    )
