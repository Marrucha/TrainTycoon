import datetime
import json
import math
import random

from firebase_functions import scheduler_fn, https_fn, firestore_fn, tasks_fn, options
from firebase_admin import initialize_app, firestore, functions as admin_functions

from demand_calc import calc_demand_for_train_sets, _collect_segments_for_debug
from boarding_sim import run_boarding_tick, rebuild_schedule_table, rebuild_schedule_for_trainset
from reports import save_daily_report, _calc_ticket_price, DEFAULT_PRICING
from reputation import update_reputation_metrics
from staff import run_daily_staff, run_monthly_staff, _generate_agency_lists
from hall_of_fame import update_hall_of_fame

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

    queue = admin_functions.task_queue('processDepositTask')
    queue.enqueue(
        {'pid': pid, 'dep_id': dep_id},
        opts=admin_functions.TaskOptions(schedule_time=mature_at),
    )


@tasks_fn.on_task_dispatched(
    retry_config=options.RetryConfig(max_attempts=3, min_backoff_seconds=30),
    rate_limits=options.RateLimits(max_concurrent_dispatches=50),
)
def processDepositTask(req: tasks_fn.CallableRequest) -> None:
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


def _calc_daily_breakdowns(db) -> None:
    """Once per day: roll awaria probability per kurs for every trainSet."""
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        player_trains = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/trains').stream()}
        batch = db.batch()

        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            ts_data = ts_doc.to_dict() or {}
            train_ids = ts_data.get('trainIds') or []
            conditions = [player_trains.get(tid, {}).get('condition', 1.0) for tid in train_ids]
            condition = sum(conditions) / len(conditions) if conditions else 1.0

            rozklad = ts_data.get('rozklad') or []
            kurs_ids = {str(s.get('kurs')) for s in rozklad if s.get('kurs') is not None}

            awarie = {}
            for kurs_id in kurs_ids:
                prob = (1 - condition) ** (1 / 5)
                if random.random() < prob:
                    awarie[kurs_id] = {'isAwaria': 1, 'awariaTime': random.randint(1, 59)}
                else:
                    awarie[kurs_id] = {'isAwaria': 0, 'awariaTime': 0}

            batch.update(ts_doc.reference, {'awarie': awarie})

        batch.commit()


def _get_game_date(db):
    """Compute current game date from Firestore constants.
    Returns datetime.date or None if constants are missing."""
    constants_snap = db.collection('gameConfig').document('constants').get()
    if not constants_snap.exists:
        return None
    consts = constants_snap.to_dict() or {}
    real_start_ms = consts.get('REAL_START_TIME_MS')
    game_start_ms = consts.get('GAME_START_TIME_MS')
    multiplier = consts.get('TIME_MULTIPLIER', 30)
    if not real_start_ms or not game_start_ms:
        return None
    real_now_ms = datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000
    virtual_now_ms = game_start_ms + (real_now_ms - real_start_ms) * multiplier
    game_now = datetime.datetime.fromtimestamp(virtual_now_ms / 1000, tz=datetime.timezone.utc)
    return game_now.date()


def _check_game_day_rollover(db) -> None:
    """If the game date has advanced since the last daily report, run the daily pipeline."""
    game_date = _get_game_date(db)
    if not game_date:
        return

    state_ref = db.collection('gameConfig').document('gameState')
    state = state_ref.get().to_dict() or {}
    last_date_str = state.get('lastReportDate')
    game_date_str = game_date.isoformat()

    if last_date_str is None:
        # First run: initialize without triggering pipeline
        state_ref.set({'lastReportDate': game_date_str}, merge=True)
        return

    if last_date_str == game_date_str:
        return  # Same game day, nothing to do

    # New game day — update state first to prevent double-run on concurrent ticks
    state_ref.set({'lastReportDate': game_date_str}, merge=True)

    save_daily_report(db, date_str=game_date_str)
    calc_demand_for_train_sets(db)
    _accrue_credit_line_interest(db, today=game_date)
    _calc_daily_breakdowns(db)
    run_daily_staff(db)
    run_monthly_staff(db, today=game_date)
    update_reputation_metrics(db)
    update_hall_of_fame(db)


def _accrue_credit_line_interest(db, today=None) -> None:
    """Deduct credit line costs from each player."""
    import calendar
    if today is None:
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
    """Cloud Function: fallback daily pipeline (runs via game-time rollover in tick_boarding)."""
    db = firestore.client()
    _check_game_day_rollover(db)


@scheduler_fn.on_schedule(schedule='* * * * *', timezone='Europe/Warsaw')
def tick_boarding(event: scheduler_fn.ScheduledEvent) -> None:
    """Cloud Function: live simulation of train stops + game day rollover check."""
    db = firestore.client()
    run_boarding_tick(db)
    _check_game_day_rollover(db)


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
def debug_utility_compare(req: https_fn.Request) -> https_fn.Response:
    """Porównuje utility dwóch kursów na wspólnych parach O-D.

    Query params: pid, ts1, kurs1, ts2, kurs2, hour (int)
    Przykład: ?pid=player1&ts1=trainset-moniuszko&kurs1=2&ts2=trainset-1772062501119&kurs2=0&hour=13
    """
    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8'}
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers=headers)

    pid   = req.args.get('pid', 'player1')
    ts_id1 = req.args.get('ts1')
    kurs1  = req.args.get('kurs1')
    ts_id2 = req.args.get('ts2')
    kurs2  = req.args.get('kurs2')
    hour   = int(req.args.get('hour', 13))

    if not all([ts_id1, kurs1, ts_id2, kurs2]):
        # Tryb listowania — zwróć dostępne trainSety
        db = firestore.client()
        result = []
        for doc in db.collection(f'players/{pid}/trainSet').stream():
            ts = doc.to_dict()
            kursy = sorted({str(s.get('kurs')) for s in (ts.get('rozklad') or []) if s.get('kurs') is not None})
            result.append({'id': doc.id, 'name': ts.get('name', '?'), 'kursy': kursy})
        return https_fn.Response(json.dumps(result, ensure_ascii=False, indent=2), status=200, headers=headers)

    from demand_model import (
        DEFAULT_CONFIG, get_demand, calc_price, get_beta_price,
        utility, HOUR_DEMAND_MAP, _circ_dist, _proximity_weight, class_split, haversine,
    )
    from public_player import get_public_utility

    db  = firestore.client()
    cfg_snap = db.collection('gameConfig').document('params').get()
    cfg = {**DEFAULT_CONFIG, **(cfg_snap.to_dict() if cfg_snap.exists else {})}
    cities      = {d.id: d.to_dict() for d in db.collection('cities').stream()}
    base_trains = {d.id: d.to_dict() for d in db.collection('trains').stream()}

    segs1, meta1, err1 = _collect_segments_for_debug(db, pid, ts_id1, kurs1, cfg, cities, base_trains)
    segs2, meta2, err2 = _collect_segments_for_debug(db, pid, ts_id2, kurs2, cfg, cities, base_trains)

    if err1 or err2:
        return https_fn.Response(json.dumps({'error': err1 or err2}), status=400, headers=headers)

    od1 = {s['od']: s for s in segs1}
    od2 = {s['od']: s for s in segs2}
    common = sorted(set(od1.keys()) & set(od2.keys()))

    output = {
        'train1': meta1,
        'train2': meta2,
        'hour': hour,
        'all_od_train1': [s['od'] for s in segs1],
        'all_od_train2': [s['od'] for s in segs2],
        'common_od': [],
    }

    for od_key in common:
        s1, s2 = od1[od_key], od2[od_key]
        city_ids = od_key.split(':')
        city_a = cities.get(city_ids[0], {})
        city_b = cities.get(city_ids[1], {})
        gravity = get_demand(city_a, city_b) if city_a and city_b else 0
        pop_max = max(city_a.get('population', 100_000), city_b.get('population', 100_000))
        hour_demand = gravity * HOUR_DEMAND_MAP[hour]

        avg_p2    = (s1['price2'] + s2['price2']) / 2
        beta_price = get_beta_price(cfg['elasticity'], avg_p2)

        def seg_utility(s):
            return utility(
                s['price2'], s['time_min'], s['reputation'], s['has_restaurant'],
                beta_price, cfg['betaTime'], cfg['betaRep'],
            )

        u1, u2 = seg_utility(s1), seg_utility(s2)
        exp_u1, exp_u2 = math.exp(min(u1, 500)), math.exp(min(u2, 500))
        circ1, circ2 = _circ_dist(hour, s1['dep_hour']), _circ_dist(hour, s2['dep_hour'])
        prox1, prox2 = _proximity_weight(circ1), _proximity_weight(circ2)
        min_dist = min(circ1, circ2)
        base_w   = _proximity_weight(min_dist)
        winners  = []
        if circ1 == min_dist and base_w > 0: winners.append('train1')
        if circ2 == min_dist and base_w > 0: winners.append('train2')

        exp_pub = math.exp(min(
            get_public_utility(s1['dist_km'], cfg, beta_price, cfg['betaTime'], cfg['betaRep']),
            500,
        ))
        accessible = hour_demand * base_w
        exp_sum = exp_pub + sum([exp_u1 if 'train1' in winners else 0,
                                  exp_u2 if 'train2' in winners else 0])

        pax1 = accessible * (exp_u1 / exp_sum) if 'train1' in winners and exp_sum > 0 else 0
        pax2 = accessible * (exp_u2 / exp_sum) if 'train2' in winners and exp_sum > 0 else 0
        pax_pub = accessible * (exp_pub / exp_sum) if exp_sum > 0 else 0

        output['common_od'].append({
            'od': od_key,
            'from': s1['from_name'], 'to': s1['to_name'],
            'gravity': round(gravity, 2),
            'hour_demand': round(hour_demand, 2),
            'accessible_demand': round(accessible, 2),
            'train1': {
                'dep_time': s1['dep_time'], 'arr_time': s1['arr_time'],
                'dep_hour': s1['dep_hour'], 'dist_km': s1['dist_km'],
                'time_min': s1['time_min'], 'price2': s1['price2'],
                'reputation': s1['reputation'], 'has_restaurant': s1['has_restaurant'],
                'utility': round(u1, 4), 'exp_u': round(exp_u1, 4),
                'voronoi_dist': circ1, 'voronoi_wins': 'train1' in winners,
                'pax_this_hour': round(pax1, 2),
            },
            'train2': {
                'dep_time': s2['dep_time'], 'arr_time': s2['arr_time'],
                'dep_hour': s2['dep_hour'], 'dist_km': s2['dist_km'],
                'time_min': s2['time_min'], 'price2': s2['price2'],
                'reputation': s2['reputation'], 'has_restaurant': s2['has_restaurant'],
                'utility': round(u2, 4), 'exp_u': round(exp_u2, 4),
                'voronoi_dist': circ2, 'voronoi_wins': 'train2' in winners,
                'pax_this_hour': round(pax2, 2),
            },
            'public_exp_u': round(exp_pub, 4),
            'public_pax_this_hour': round(pax_pub, 2),
        })

    return https_fn.Response(json.dumps(output, ensure_ascii=False, indent=2), status=200, headers=headers)


@https_fn.on_request()
def generate_agency_lists_manual(req: https_fn.Request) -> https_fn.Response:
    """Tymczasowy endpoint – generuje listy kandydatów agencji dla wszystkich graczy."""
    db = firestore.client()
    _generate_agency_lists(db)
    return https_fn.Response(
        'Agency lists generated.\n',
        status=200,
        headers={'Access-Control-Allow-Origin': '*'},
    )


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
def manual_update_hall_of_fame(req: https_fn.Request) -> https_fn.Response:
    db = firestore.client()
    update_hall_of_fame(db)
    return https_fn.Response("Hall of Fame updated successfully.\n", status=200)


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
def fix_dispatch_dates(req: https_fn.Request) -> https_fn.Response:
    """Naprawa błędnych dispatchDate — usuwa przyszłe dispatchDate z trainSetów,
    które mają już obliczony dailyDemand (czyli są gotowe do odbioru pasażerów).

    Przyczyna błędu: dispatchDate był obliczany względem następnego 3:00 REALNEGO czasu
    zamiast 3:00 WIRTUALNEGO czasu gry, co powodowało blokadę przez nawet 24h realne.
    """
    import time as _time
    db = firestore.client()
    c_snap = db.collection('gameConfig').document('constants').get()
    consts = c_snap.to_dict() or {} if c_snap.exists else {}
    real_start_ms = consts.get('REAL_START_TIME_MS')
    game_start_ms = consts.get('GAME_START_TIME_MS')
    multiplier = consts.get('TIME_MULTIPLIER', 30)

    if not real_start_ms:
        return https_fn.Response('Brak REAL_START_TIME_MS w constants.\n', status=400)

    virt_now_ms = game_start_ms + (int(_time.time() * 1000) - real_start_ms) * multiplier

    fixed = 0
    batch = db.batch()
    batch_count = 0

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            ts = ts_doc.to_dict() or {}
            dispatch_ms = ts.get('dispatchDate')
            if not dispatch_ms:
                continue
            if dispatch_ms <= virt_now_ms:
                continue  # already in the past — OK
            daily_demand = ts.get('dailyDemand') or {}
            if not daily_demand:
                continue  # no demand yet — leave it alone
            # dispatchDate is in the future but train already has demand: fix it
            batch.update(ts_doc.reference, {'dispatchDate': None})
            fixed += 1
            batch_count += 1
            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0

    if batch_count:
        batch.commit()

    return https_fn.Response(
        f'Naprawiono {fixed} trainSet(ów) z błędnym dispatchDate.\n',
        status=200,
        headers={'Access-Control-Allow-Origin': '*'},
    )


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


@firestore_fn.on_document_written(document='players/{pid}/trainSet/{ts_id}')
def track_trainset_changes(event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot | None]]) -> None:
    """Track changes to specific trainSets with fine-grained weights.
    - Delete / Remove Stop: 5
    - Remove Wagon / Edit Times (same stops): 1
    - Add Wagon / Price Change: 0
    """
    db = firestore.client()
    pid = event.params['pid']
    ts_id = event.params['ts_id']
    
    action_ref = db.collection(f'players/{pid}/dailyActions').document(ts_id)
    
    # CASE 1: Document deleted
    if event.data.after is None:
        action_ref.set({'weight': 5, 'ts_id': ts_id})
        return

    # CASE 2: Document created
    if event.data.before is None:
        action_ref.set({'weight': 1, 'ts_id': ts_id})
        return

    # CASE 3: Document updated - analyze delta
    old = event.data.before.to_dict()
    new = event.data.after.to_dict()
    
    weight = 0
    
    # 3.1 Check Stops (Rozklad)
    old_stops = set(s.get('miasto', '') for s in old.get('rozklad', []))
    new_stops = set(s.get('miasto', '') for s in new.get('rozklad', []))
    
    # Calculate how many stops were removed
    removed_count = sum(1 for s in old_stops if s not in new_stops)
    
    if removed_count == 1:
        weight = 3
    elif removed_count == 2:
        weight = 4
    elif removed_count >= 3:
        weight = 5
    elif old.get('rozklad') != new.get('rozklad'):
        # Schedule changed but no stops removed -> Edit (1)
        weight = 1
        
    # 3.2 Check Wagons (trainIds)
    old_trains = old.get('trainIds', [])
    new_trains = new.get('trainIds', [])
    if len(new_trains) < len(old_trains):
        # Removed wagon -> 1 (if not already 5)
        weight = max(weight, 1)
        
    # If weight > 0, update today's action
    # We use MERGE to keep the MAX weight today for this ts_id
    if weight > 0:
        existing = action_ref.get()
        if existing.exists:
            curr_w = existing.to_dict().get('weight', 0)
            if weight > curr_w:
                action_ref.set({'weight': weight, 'ts_id': ts_id})
        else:
            action_ref.set({'weight': weight, 'ts_id': ts_id})
