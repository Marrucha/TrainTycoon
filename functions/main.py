import datetime
import json
import math

from firebase_functions import scheduler_fn, https_fn, firestore_fn, tasks_fn, options
from firebase_admin import initialize_app, firestore, functions as admin_functions

from demand_calc import calc_demand_for_train_sets
from boarding_sim import run_boarding_tick, rebuild_schedule_table, rebuild_schedule_for_trainset
from reports import save_daily_report, _calc_ticket_price, DEFAULT_PRICING
from reputation import update_reputation_metrics

initialize_app()


@firestore_fn.on_document_created(document='players/{pid}/deposits/{dep_id}')
def on_deposit_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot],
) -> None:
    """Firestore trigger: schedule deposit maturation via Cloud Tasks."""
    data = event.data.to_dict() if event.data else {}
    mature_at_str = data.get('matureAt', '')
    if not mature_at_str:
        return

    pid = event.params['pid']
    dep_id = event.params['dep_id']

    mature_at = datetime.datetime.fromisoformat(mature_at_str.replace('Z', '+00:00'))

    queue = admin_functions.task_queue('process_deposit_task')
    queue.enqueue(
        {'pid': pid, 'dep_id': dep_id},
        opts=admin_functions.TaskOptions(schedule_time=mature_at),
    )


@tasks_fn.on_task_dispatched(
    retry_config=options.RetryConfig(max_attempts=3, min_backoff_seconds=30),
    rate_limits=options.RateLimits(max_concurrent_dispatches=50),
)
def process_deposit_task(req: tasks_fn.CallableRequest) -> None:
    """Cloud Task handler: materialize a single deposit at maturity."""
    pid = req.data.get('pid')
    dep_id = req.data.get('dep_id')
    if not pid or not dep_id:
        return

    db = firestore.client()
    dep_ref = db.collection(f'players/{pid}/deposits').document(dep_id)
    dep_snap = dep_ref.get()
    if not dep_snap.exists:
        return

    dep = dep_snap.to_dict()
    player_ref = db.collection('players').document(pid)
    balance = (player_ref.get().to_dict() or {}).get('finance', {}).get('balance', 0)
    total_return = round(dep['amount'] * (1 + dep['rate']))

    batch = db.batch()
    batch.delete(dep_ref)
    batch.update(player_ref, {'finance.balance': balance + total_return})
    batch.commit()


def _accrue_credit_line_interest(db) -> None:
    """Deduct credit line costs from each player."""
    import calendar
    today = datetime.date.today()
    players = db.collection('players').stream()
    for player_doc in players:
        data = player_doc.to_dict() or {}
        finance = data.get('finance', {})
        cl = finance.get('creditLine')
        if not cl:
            continue
        balance = finance.get('balance', 0)
        limit = cl['limit']
        used = max(0, limit - balance)
        daily_interest = round(used * cl.get('annualRate', 0.06) / 365)

        opened_day = datetime.date.fromisoformat(cl['openedAt'][:10]).day
        last_day_of_month = calendar.monthrange(today.year, today.month)[1]
        billing_day = min(opened_day, last_day_of_month)
        monthly_fee = round(limit * cl.get('commitmentRate', 0.01) / 12) if today.day == billing_day else 0

        total = daily_interest + monthly_fee
        if total > 0:
            player_doc.reference.update({'finance.balance': balance - total})


@scheduler_fn.on_schedule(schedule='0 3 * * *', timezone='Europe/Warsaw')
def calc_daily_demand(event: scheduler_fn.ScheduledEvent) -> None:
    """Cloud Function: Daily demand calculation and maintenance."""
    db = firestore.client()
    save_daily_report(db)
    calc_demand_for_train_sets(db)
    _accrue_credit_line_interest(db)
    update_reputation_metrics(db)


@scheduler_fn.on_schedule(schedule='* * * * *', timezone='Europe/Warsaw')
def tick_boarding(event: scheduler_fn.ScheduledEvent) -> None:
    """Cloud Function: live simulation of train stops."""
    db = firestore.client()
    run_boarding_tick(db)


@firestore_fn.on_document_written(document='players/{pid}/trainSet/{ts_id}')
def on_trainset_written(
    event: firestore_fn.Event[firestore_fn.Change],
) -> None:
    """Firestore trigger: rebuild schedule table on trainSet save/delete."""
    pid   = event.params['pid']
    ts_id = event.params['ts_id']
    ts_data = event.data.after.to_dict() if event.data.after else None
    db = firestore.client()
    rebuild_schedule_for_trainset(db, pid, ts_id, ts_data)


@https_fn.on_request()
def rebuild_schedule(req: https_fn.Request) -> https_fn.Response:
    db      = firestore.client()
    written = rebuild_schedule_table(db)
    return https_fn.Response(f'Schedule table rebuilt: {written} records.\n', status=200)


@https_fn.on_request()
def manual_update_reputation(req: https_fn.Request) -> https_fn.Response:
    """HTTP trigger to manually trigger price reputation update."""
    db = firestore.client()
    update_reputation_metrics(db)
    return https_fn.Response("Reputation updated successfully.\n", status=200)


@https_fn.on_request()
def calc_demand_manual(req: https_fn.Request) -> https_fn.Response:
    db = firestore.client()
    updated = calc_demand_for_train_sets(db)
    return https_fn.Response(f'Demand calculated: {updated} trainSet(s) updated.\n', status=200)


@https_fn.on_request()
def boarding_tick_manual(req: https_fn.Request) -> https_fn.Response:
    now_str = req.args.get('time') or None
    db = firestore.client()
    count = run_boarding_tick(db, now_str=now_str)
    return https_fn.Response(f'Boarding tick processed {count} stop event(s) at {now_str or "now"}.\n', status=200)


@https_fn.on_request()
def debug_demand(req: https_fn.Request) -> https_fn.Response:
    now_str = req.args.get('time') or '00:06'
    db = firestore.client()
    sched_ref = db.collection('rozkłady')
    dep_docs  = list(sched_ref.where('departure_times', 'array_contains', now_str).stream())
    result = []
    for doc in dep_docs:
        data = doc.to_dict()
        ts_id = data.get('ts_id'); pid = data.get('player_id')
        ts_snap = db.collection(f'players/{pid}/trainSet').document(ts_id).get()
        ts = ts_snap.to_dict() if ts_snap.exists else {}
        daily_demand = ts.get('dailyDemand', {}); kurs_id = str(data.get('kurs_id'))
        for stop in data.get('stops', []):
            if stop.get('odjazd') == now_str:
                result.append({
                    'ts_id': ts_id, 'kurs_id': kurs_id, 'city_id': stop['city_id'],
                    'demand_at_city': { k: v for k, v in daily_demand.get(kurs_id, {}).get('od', {}).items()
                        if k.startswith(stop['city_id'] + ':') and (k.split(':')[1] in set(stop.get('forward_ids', []))) }
                })
    return https_fn.Response(json.dumps(result, ensure_ascii=False, indent=2), status=200, headers={'Content-Type': 'application/json'})
