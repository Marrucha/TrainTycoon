import datetime
import json
import math
import random

from firebase_functions import scheduler_fn, https_fn, firestore_fn, tasks_fn, options
from firebase_admin import initialize_app, firestore, functions as admin_functions, auth as fb_auth

from demand_calc import calc_demand_for_train_sets, _collect_segments_for_debug
from boarding_sim import (
    run_boarding_tick, run_boarding_rollover, _clear_daily_boarding_state,
    rebuild_schedule_table, rebuild_schedule_for_trainset,
)
from reports import save_daily_report, _calc_ticket_price, DEFAULT_PRICING
from reputation import update_reputation_metrics
from staff import run_daily_staff, run_monthly_staff, _generate_agency_lists
from hall_of_fame import update_hall_of_fame
from exchange import update_exchange_prices, _check_listing_eligibility, _compute_nav, _get_market_price
from finance_ops import (
    _get_game_date, _accrue_credit_line_interest,
    _process_loan_payments, _calc_daily_breakdowns,
)

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
    interest = round(dep['amount'] * dep['rate'])
    total_return = dep['amount'] + interest

    date_str = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    ledger_ref = db.collection(f'players/{pid}/financeLedger').document(date_str)

    batch = db.batch()
    batch.delete(dep_ref)
    batch.update(player_ref, {'finance.balance': balance + total_return})
    batch.set(ledger_ref, {
        'date': date_str,
        'revenues': {'depositInterest': interest},
    }, merge=True)
    batch.commit()


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

    import datetime as _dt
    yesterday = game_date - _dt.timedelta(days=1)
    yesterday_str = yesterday.isoformat()

    run_boarding_rollover(db)              # 1. simulate full day → writes dailyTransfer
    save_daily_report(db, date_str=yesterday_str)  # 2. reads dailyTransfer → updates finance (date = day that just ended)
    calc_demand_for_train_sets(db)         # 3. writes new dailyDemand for next day
    _clear_daily_boarding_state(db)        # 4. reset dailyTransfer/currentTransfer for new day
    _accrue_credit_line_interest(db, today=game_date)
    _process_loan_payments(db, today=game_date)
    _calc_daily_breakdowns(db)
    run_daily_staff(db)
    run_monthly_staff(db, today=game_date)
    update_reputation_metrics(db)
    update_hall_of_fame(db, game_date=game_date)
    update_exchange_prices(db, game_date=game_date)


@scheduler_fn.on_schedule(schedule='0 3 * * *', timezone='Europe/Warsaw')
def calc_daily_demand(event: scheduler_fn.ScheduledEvent) -> None:
    """Cloud Function: fallback daily pipeline (runs via game-time rollover in tick_boarding)."""
    db = firestore.client()
    _check_game_day_rollover(db)


@scheduler_fn.on_schedule(schedule='*/15 * * * *', timezone='Europe/Warsaw')
def tick_boarding(event: scheduler_fn.ScheduledEvent) -> None:
    """Cloud Function: game day rollover check (runs every 15 real min ≈ 7.5 virtual hours).
    Boarding simulation is now handled by the frontend; backend simulates only at midnight."""
    db = firestore.client()
    _check_game_day_rollover(db)


@firestore_fn.on_document_written(document='players/{pid}/trainSet/{ts_id}')
def on_trainset_written(
    event: firestore_fn.Event[firestore_fn.Change],
) -> None:
    """Firestore trigger: rebuild schedule table on trainSet save/delete."""
    pid   = event.params['pid']
    ts_id = event.params['ts_id']
    ts_data = event.data.after.to_dict() if event.data.after else None
    if ts_data and ts_data.get('_boardingWrite'):
        return  # zapis z boardingu — nie przebudowuj rozkładu
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
    """HTTP endpoint: manually trigger agency candidate list generation for all players."""
    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST'}
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers=cors)
    try:
        db = firestore.client()
        c_snap = db.collection('gameConfig').document('constants').get()
        consts = c_snap.to_dict() or {} if c_snap.exists else {}
        _generate_agency_lists(db, consts)
        return https_fn.Response('Agency lists generated.\n', status=200, headers=cors)
    except Exception as e:
        return https_fn.Response(str(e), status=500, headers=cors)


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
    update_hall_of_fame(db, game_date=_get_game_date(db))
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


_CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

BUY_SPREAD  = 1.02   # kupujący płaci 2% powyżej market
SELL_SPREAD = 0.98   # sprzedający otrzymuje 2% poniżej market
PRESSURE_PER_FLOAT = 0.50   # kupno/sprzedaż 10% freeFloat → ±5% presji
DAILY_VOLUME_CAP   = 0.05   # max 5% freeFloat na parę kupujący-spółka dziennie
DAILY_VOLUME_ABS   = 50_000 # max 50 000 akcji dziennie (hard cap)
MIN_ACCOUNT_DAYS   = 14     # cooldown konta (game-dni)
DIVIDEND_COOLDOWN  = 30     # min game-dni między dywidendami


def _verify_token(req) -> str:
    """Sprawdza Bearer token i zwraca uid. Rzuca ValueError jeśli brak/błąd."""
    auth_header = req.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise ValueError('Brak tokenu autoryzacji')
    token = auth_header[7:]
    decoded = fb_auth.verify_id_token(token)
    return decoded['uid']


def _cors_preflight(req):
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers=_CORS)
    return None


@https_fn.on_request()
def exchange_trade(req: https_fn.Request) -> https_fn.Response:
    """Kupno lub sprzedaż akcji przez gracza.

    Body JSON: { type: 'buy'|'sell', targetUid: str, shares: int }
    """
    pre = _cors_preflight(req)
    if pre:
        return pre

    try:
        buyer_uid = _verify_token(req)
    except Exception as e:
        return https_fn.Response(json.dumps({'error': str(e)}), status=401, headers=_CORS)

    try:
        body = req.get_json(silent=True) or {}
        trade_type = body.get('type')           # 'buy' | 'sell'
        target_uid = body.get('targetUid')
        shares     = int(body.get('shares', 0))

        if trade_type not in ('buy', 'sell'):
            return https_fn.Response(json.dumps({'error': 'Nieprawidłowy typ transakcji'}), status=400, headers=_CORS)
        if not target_uid:
            return https_fn.Response(json.dumps({'error': 'Brak targetUid'}), status=400, headers=_CORS)
        if shares <= 0:
            return https_fn.Response(json.dumps({'error': 'Liczba akcji musi być > 0'}), status=400, headers=_CORS)
        if buyer_uid == target_uid:
            return https_fn.Response(json.dumps({'error': 'Nie możesz kupować własnych akcji'}), status=400, headers=_CORS)

        db = firestore.client()
        game_date = _get_game_date(db)
        date_str  = game_date.isoformat() if game_date else datetime.date.today().isoformat()

        # Dane spółki z giełdy
        ex_ref  = db.collection('exchange').document(target_uid)
        ex_snap = ex_ref.get()
        if not ex_snap.exists or not (ex_snap.to_dict() or {}).get('isListed'):
            return https_fn.Response(json.dumps({'error': 'Spółka nie jest notowana na giełdzie'}), status=400, headers=_CORS)
        ex_data      = ex_snap.to_dict()
        market_price = ex_data.get('marketPrice', 1.0)
        free_float   = ex_data.get('freeFloat', 0)
        pressure     = ex_data.get('pressureAccumulator', 0.0)
        fund_price   = ex_data.get('fundamentalPrice', market_price)

        # Dane kupującego
        buyer_snap = db.collection('players').document(buyer_uid).get()
        if not buyer_snap.exists:
            return https_fn.Response(json.dumps({'error': 'Gracz nie istnieje'}), status=400, headers=_CORS)
        buyer_data       = buyer_snap.to_dict() or {}
        personal_balance = (buyer_data.get('personal') or {}).get('balance', 0)

        # Cooldown konta (min 14 game-dni)
        if game_date:
            created_at = buyer_data.get('createdAt', '')
            if created_at:
                try:
                    created = datetime.date.fromisoformat(created_at[:10])
                    if (game_date - created).days < MIN_ACCOUNT_DAYS:
                        return https_fn.Response(
                            json.dumps({'error': f'Konto musi mieć co najmniej {MIN_ACCOUNT_DAYS} game-dni historii'}),
                            status=400, headers=_CORS,
                        )
                except ValueError:
                    pass

        # Portfel kupującego
        port_ref  = db.collection('portfolios').document(buyer_uid)
        port_snap = port_ref.get()
        port_data = port_snap.to_dict() if port_snap.exists else {}
        holdings  = port_data.get('holdings') or {}
        holding   = holdings.get(target_uid) or {'shares': 0, 'avgBuyPrice': 0.0, 'totalInvested': 0.0}

        if trade_type == 'buy':
            # Limit dzienny (5% freeFloat lub 50 000 akcji)
            daily_cap = min(int(free_float * DAILY_VOLUME_CAP), DAILY_VOLUME_ABS)
            if shares > daily_cap:
                return https_fn.Response(
                    json.dumps({'error': f'Limit dzienny: max {daily_cap:,} akcji tej spółki'}),
                    status=400, headers=_CORS,
                )
            if shares > free_float:
                return https_fn.Response(
                    json.dumps({'error': f'Niewystarczająca liczba akcji w wolnym obrocie ({free_float:,})'}),
                    status=400, headers=_CORS,
                )
            price_per_share  = round(market_price * BUY_SPREAD, 2)
            total_cost       = round(price_per_share * shares)
            if personal_balance < total_cost:
                return https_fn.Response(
                    json.dumps({'error': f'Niewystarczające środki osobiste. Potrzeba {total_cost:,} PLN, masz {personal_balance:,} PLN'}),
                    status=400, headers=_CORS,
                )
            new_personal     = personal_balance - total_cost
            new_free_float   = free_float - shares
            new_shares       = holding['shares'] + shares
            total_invested   = holding.get('totalInvested', 0) + total_cost
            new_avg          = round(total_invested / new_shares, 2) if new_shares else 0
            pressure_delta   = PRESSURE_PER_FLOAT * (shares / max(1, free_float))

        else:  # sell
            owned_shares = holding.get('shares', 0)
            if shares > owned_shares:
                return https_fn.Response(
                    json.dumps({'error': f'Masz tylko {owned_shares:,} akcji tej spółki'}),
                    status=400, headers=_CORS,
                )
            price_per_share  = round(market_price * SELL_SPREAD, 2)
            total_value      = round(price_per_share * shares)
            new_personal     = personal_balance + total_value
            new_free_float   = free_float + shares
            new_shares       = owned_shares - shares
            total_invested   = holding.get('totalInvested', 0) * (new_shares / owned_shares) if owned_shares else 0
            new_avg          = holding.get('avgBuyPrice', 0)
            total_cost       = 0
            pressure_delta   = -PRESSURE_PER_FLOAT * (shares / max(1, free_float))

        # Nowa presja i cena rynkowa
        new_pressure = pressure + pressure_delta
        raw_new_market = fund_price * (1 + new_pressure)
        new_market = max(
            fund_price * 0.85,
            min(fund_price * 1.20, raw_new_market),
        )
        new_market = round(new_market, 2)

        # Batch update
        batch = db.batch()

        # Kupujący: personal balance
        batch.update(buyer_snap.reference, {'personal.balance': round(new_personal)})

        # exchange/{target}: freeFloat, pressure, marketPrice
        batch.update(ex_ref, {
            'freeFloat':           new_free_float,
            'pressureAccumulator': round(new_pressure, 6),
            'marketPrice':         new_market,
        })

        # priceHistory: aktualizuj volume, high, low
        hist_ref  = ex_ref.collection('priceHistory').document(date_str)
        hist_snap = hist_ref.get()
        if hist_snap.exists:
            hd = hist_snap.to_dict() or {}
            batch.update(hist_ref, {
                'volume': hd.get('volume', 0) + shares,
                'high':   max(hd.get('high', new_market), new_market),
                'low':    min(hd.get('low', new_market), new_market),
                'closePrice': new_market,
            })
        else:
            batch.set(hist_ref, {
                'date': date_str,
                'volume': shares,
                'high': new_market,
                'low': new_market,
                'openPrice': market_price,
                'closePrice': new_market,
                'fundamentalPrice': fund_price,
            })

        # Portfolio kupującego
        new_holding = {
            'shares':        new_shares,
            'avgBuyPrice':   new_avg,
            'totalInvested': round(total_invested),
        }
        if new_shares == 0:
            # usuń holding jeśli sprzedano wszystko
            import google.cloud.firestore
            batch.update(port_ref, {f'holdings.{target_uid}': google.cloud.firestore.DELETE_FIELD})
        else:
            batch.set(port_ref, {
                'uid': buyer_uid,
                'holdings': {target_uid: new_holding},
                'lastUpdated': date_str,
            }, merge=True)

        # tradeHistory
        import uuid
        trade_id  = str(uuid.uuid4())[:16]
        trade_ref = db.collection(f'portfolios/{buyer_uid}/tradeHistory').document(trade_id)
        batch.set(trade_ref, {
            'type':          trade_type,
            'targetUid':     target_uid,
            'targetName':    ex_data.get('companyName', ''),
            'shares':        shares,
            'pricePerShare': price_per_share,
            'totalValue':    round(price_per_share * shares),
            'gameDate':      date_str,
            'timestamp':     datetime.datetime.utcnow().isoformat(),
            'sourceIp':      req.remote_addr,
        })

        batch.commit()

        return https_fn.Response(json.dumps({
            'success':       True,
            'pricePerShare': price_per_share,
            'totalValue':    round(price_per_share * shares),
            'newMarketPrice': new_market,
            'newBalance':    round(new_personal),
            'newShares':     new_shares,
        }), status=200, headers={**_CORS, 'Content-Type': 'application/json'})

    except Exception as e:
        return https_fn.Response(json.dumps({'error': str(e)}), status=500, headers=_CORS)


@https_fn.on_request()
def request_listing(req: https_fn.Request) -> https_fn.Response:
    """Gracz składa wniosek o notowanie spółki na giełdzie.

    Nie wymaga body — sprawdza dane uwierzytelnionego gracza.
    """
    pre = _cors_preflight(req)
    if pre:
        return pre

    try:
        uid = _verify_token(req)
    except Exception as e:
        return https_fn.Response(json.dumps({'error': str(e)}), status=401, headers=_CORS)

    try:
        db = firestore.client()
        game_date = _get_game_date(db)
        if not game_date:
            return https_fn.Response(json.dumps({'error': 'Brak daty gry'}), status=500, headers=_CORS)

        player_snap = db.collection('players').document(uid).get()
        if not player_snap.exists:
            return https_fn.Response(json.dumps({'error': 'Gracz nie istnieje'}), status=400, headers=_CORS)

        player_data = player_snap.to_dict() or {}
        company     = player_data.get('company') or {}

        if company.get('isListed'):
            return https_fn.Response(json.dumps({'error': 'Spółka jest już notowana na giełdzie'}), status=400, headers=_CORS)

        eligible, checks = _check_listing_eligibility(db, uid, player_data, game_date)
        if not eligible:
            return https_fn.Response(json.dumps({'eligible': False, 'checks': checks}),
                                     status=200, headers={**_CORS, 'Content-Type': 'application/json'})

        # Debiut giełdowy
        date_str     = game_date.isoformat()
        total_shares = company.get('totalShares', 1_000_000)
        free_float   = company.get('freeFloat', 0)
        reputation   = player_data.get('reputation', 0)
        nav, _nav_bd = _compute_nav(db, uid, player_data)

        # Prosta cena startowa — tylko NAV (brak historii earnings)
        fund_price = max(1.0, round(max(1_000_000, nav) / max(1, total_shares), 2))

        ex_ref = db.collection('exchange').document(uid)
        ex_ref.set({
            'ownerUid':            uid,
            'companyName':         player_data.get('companyName', ''),
            'isListed':            True,
            'listedAt':            date_str,
            'fundamentalPrice':    fund_price,
            'marketPrice':         fund_price,
            'prevDayPrice':        fund_price,
            'pressureAccumulator': 0.0,
            'totalShares':         total_shares,
            'freeFloat':           free_float,
            'uniqueHolders':       0,
            'nav':                 round(nav),
            'earningsValue':       0,
            'peMultiple':          8.0,
            'trailingDailyNet':    0,
            'lastUpdated':         date_str,
        })

        db.collection('players').document(uid).update({
            'company.isListed': True,
            'company.listedAt': date_str,
        })

        return https_fn.Response(json.dumps({
            'eligible':    True,
            'checks':      checks,
            'fundPrice':   fund_price,
            'marketPrice': fund_price,
        }), status=200, headers={**_CORS, 'Content-Type': 'application/json'})

    except Exception as e:
        return https_fn.Response(json.dumps({'error': str(e)}), status=500, headers=_CORS)


@https_fn.on_request()
def pay_dividend(req: https_fn.Request) -> https_fn.Response:
    """Właściciel wypłaca dywidendę akcjonariuszom.

    Body JSON: { plnPerShare: number }
    Min 30 game-dni od ostatniej dywidendy. Pobiera z finance.balance właściciela,
    rozdaje do personal.balance każdego akcjonariusza.
    """
    pre = _cors_preflight(req)
    if pre:
        return pre

    try:
        owner_uid = _verify_token(req)
    except Exception as e:
        return https_fn.Response(json.dumps({'error': str(e)}), status=401, headers=_CORS)

    try:
        body          = req.get_json(silent=True) or {}
        pln_per_share = float(body.get('plnPerShare', 0))
        if pln_per_share <= 0:
            return https_fn.Response(json.dumps({'error': 'plnPerShare musi być > 0'}), status=400, headers=_CORS)

        db        = firestore.client()
        game_date = _get_game_date(db)
        if not game_date:
            return https_fn.Response(json.dumps({'error': 'Brak daty gry'}), status=500, headers=_CORS)
        date_str  = game_date.isoformat()

        ex_ref  = db.collection('exchange').document(owner_uid)
        ex_snap = ex_ref.get()
        if not ex_snap.exists or not (ex_snap.to_dict() or {}).get('isListed'):
            return https_fn.Response(json.dumps({'error': 'Spółka nie jest notowana'}), status=400, headers=_CORS)
        ex_data = ex_snap.to_dict()

        # Cooldown 30 game-dni
        last_div = ex_data.get('lastDividendAt')
        if last_div:
            try:
                last_div_date = datetime.date.fromisoformat(last_div[:10])
                if (game_date - last_div_date).days < DIVIDEND_COOLDOWN:
                    days_left = DIVIDEND_COOLDOWN - (game_date - last_div_date).days
                    return https_fn.Response(
                        json.dumps({'error': f'Kolejna dywidenda możliwa za {days_left} game-dni'}),
                        status=400, headers=_CORS,
                    )
            except ValueError:
                pass

        # Kasa firmy właściciela
        owner_snap    = db.collection('players').document(owner_uid).get()
        owner_data    = owner_snap.to_dict() or {}
        finance_bal   = (owner_data.get('finance') or {}).get('balance', 0)

        # Zbierz wszystkich posiadaczy akcji
        holders = []  # list of (port_uid, shares)
        for port_doc in db.collection('portfolios').stream():
            port_uid  = port_doc.id
            port_data = port_doc.to_dict() or {}
            h_shares  = (port_data.get('holdings') or {}).get(owner_uid, {}).get('shares', 0)
            if h_shares > 0:
                holders.append((port_uid, h_shares))

        if not holders:
            return https_fn.Response(json.dumps({'error': 'Brak akcjonariuszy z akcjami w obrocie'}), status=400, headers=_CORS)

        total_payout = round(sum(shares * pln_per_share for _, shares in holders))
        if finance_bal < total_payout:
            return https_fn.Response(
                json.dumps({'error': f'Niewystarczające środki firmy. Potrzeba {total_payout:,} PLN, masz {finance_bal:,} PLN'}),
                status=400, headers=_CORS,
            )

        # Batch: odejmij z kasy firmy, dodaj do każdego akcjonariusza
        batch = db.batch()
        batch.update(owner_snap.reference, {'finance.balance': finance_bal - total_payout})

        for port_uid, h_shares in holders:
            holder_snap = db.collection('players').document(port_uid).get()
            if not holder_snap.exists:
                continue
            holder_personal = (holder_snap.to_dict() or {}).get('personal', {}).get('balance', 0)
            payout = round(h_shares * pln_per_share)
            batch.update(holder_snap.reference, {'personal.balance': holder_personal + payout})

            # tradeHistory dla akcjonariusza
            import uuid
            div_ref = db.collection(f'portfolios/{port_uid}/tradeHistory').document(str(uuid.uuid4())[:16])
            batch.set(div_ref, {
                'type':          'dividend',
                'targetUid':     owner_uid,
                'targetName':    ex_data.get('companyName', ''),
                'shares':        h_shares,
                'pricePerShare': pln_per_share,
                'totalValue':    payout,
                'gameDate':      date_str,
                'timestamp':     datetime.datetime.utcnow().isoformat(),
            })

        # Zaktualizuj lastDividendAt w exchange
        batch.update(ex_ref, {'lastDividendAt': date_str})

        # Zapis do ledgera firmy
        ledger_ref = db.collection(f'players/{owner_uid}/financeLedger').document(date_str)
        batch.set(ledger_ref, {
            'oneTimeCosts': [{'type': 'dividend', 'amount': total_payout,
                              'desc': f'Dywidenda {pln_per_share} PLN/akcję ({len(holders)} akcjonariuszy)'}],
        }, merge=True)

        batch.commit()

        return https_fn.Response(json.dumps({
            'success':      True,
            'totalPayout':  total_payout,
            'holdersCount': len(holders),
            'plnPerShare':  pln_per_share,
        }), status=200, headers={**_CORS, 'Content-Type': 'application/json'})

    except Exception as e:
        return https_fn.Response(json.dumps({'error': str(e)}), status=500, headers=_CORS)


@https_fn.on_request()
def manual_update_exchange(req: https_fn.Request) -> https_fn.Response:
    """HTTP trigger: ręczna aktualizacja cen giełdowych."""
    db = firestore.client()
    game_date = _get_game_date(db)
    if not game_date:
        return https_fn.Response('Brak daty gry.\n', status=500)
    update_exchange_prices(db, game_date=game_date)
    return https_fn.Response(f'Exchange prices updated for {game_date}.\n', status=200)


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
    if new.get('_boardingWrite'):
        return  # zapis z boardingu — nie śledź zmiany
    
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
