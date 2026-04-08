"""boarding_rollover.py — symulacja pełnego dnia i reset stanu.

Zawiera:
  - _simulate_full_day_for_ts()   — symulacja kompletnego dnia dla jednego trainSet
  - run_boarding_rollover()        — orchestrator rollover dla wszystkich składów
  - _clear_daily_boarding_state()  — reset dailyTransfer/currentTransfer/dailyArrivals
"""

from collections import defaultdict

from boarding_tick import (
    _get_cities, _get_base_trains, _calc_total_seats,
    _deep_copy_demand, _add_delay, _process_stop_event,
    _DEFAULT_FINE_MULTIPLIER, _DEFAULT_PENALTY_MIN, _DEFAULT_COND_CAP_PER_HOUR,
)
from staff import calc_wars_revenue, calc_fine_revenue, calc_inspection_index
from tickets_pricing import _calc_min_segment_price, DEFAULT_PRICING
from utils import _find_city


def _simulate_full_day_for_ts(ts, player_trains, base_trains, cities, pricing, emp_map, game_config=None):
    """Simulate the complete game day of boarding for a single trainSet.

    Uses ts.rozklad (not the rozkłady collection) — same algorithm as the frontend
    useBoardingSimulation hook, but processes ALL stops (not just up to current time).

    Returns (daily_transfer, daily_arrivals).
    """
    if game_config is None:
        game_config = {}

    fine_multiplier   = int(game_config.get('fineMultiplier',            _DEFAULT_FINE_MULTIPLIER))
    penalty_min       = int(game_config.get('finePenaltyMinutes',        _DEFAULT_PENALTY_MIN))
    cond_cap_per_hour = int(game_config.get('conductorPassengersPerHour', _DEFAULT_COND_CAP_PER_HOUR))

    daily_demand   = _deep_copy_demand(ts.get('dailyDemand', {}))
    daily_transfer = {}
    current_transfer = {}
    daily_arrivals = {}

    seat_caps      = _calc_total_seats(ts, player_trains, base_trains)
    gapowicze_rate = float(ts.get('gapowiczeRate', 0.0))
    awarie         = ts.get('awarie') or {}
    crew           = ts.get('crew') or {}

    barman_id  = crew.get('barman')
    barmans_exp = []
    if barman_id and emp_map:
        b_emp = emp_map.get(barman_id, {})
        if not b_emp.get('isIntern'):
            barmans_exp.append(float(b_emp.get('experience', 0.0)))

    cond_ids = crew.get('konduktorzy') or []
    n_cond   = len(cond_ids)

    # Group rozklad by kurs
    kurs_groups = defaultdict(list)
    for stop in (ts.get('rozklad') or []):
        kurs_id = str(stop.get('kurs', '_') if stop.get('kurs') is not None else '_')
        kurs_groups[kurs_id].append(stop)

    for kurs_id, stops in kurs_groups.items():
        def sort_key(s):
            t = s.get('odjazd') or s.get('przyjazd') or '00:00'
            h, m_val = map(int, t.split(':'))
            return h * 60 + m_val

        sorted_stops = sorted(stops, key=sort_key)

        # Pre-resolve city IDs using _find_city
        resolved_ids = []
        for s in sorted_stops:
            _, city_id = _find_city(cities, s.get('miasto', ''))
            resolved_ids.append(city_id or s.get('miasto', ''))

        # Compute kurs duration (minutes)
        kurs_duration = 0
        if len(sorted_stops) >= 2:
            def _min_of(t):
                if not t:
                    return 0
                h, m_val = map(int, t.split(':'))
                return h * 60 + m_val
            first_dep = _min_of(sorted_stops[0].get('odjazd') or sorted_stops[0].get('przyjazd'))
            last_arr  = _min_of(sorted_stops[-1].get('przyjazd') or sorted_stops[-1].get('odjazd'))
            kurs_duration = max(0, last_arr - first_dep)

        for i, (stop, city_id) in enumerate(zip(sorted_stops, resolved_ids)):
            is_first    = i == 0
            is_last     = i == len(sorted_stops) - 1
            forward_ids = set(resolved_ids[i + 1:])
            next_city   = resolved_ids[i + 1] if i < len(sorted_stops) - 1 else None

            # Process arrival (alight passengers)
            if not is_first and stop.get('przyjazd'):
                _process_stop_event(
                    'arrive', kurs_id, city_id, forward_ids, is_last,
                    seat_caps, daily_demand, daily_transfer, current_transfer,
                    stop['przyjazd'], next_city,
                    pricing=pricing, cities=cities, gapowicze_rate=gapowicze_rate,
                )

            # Process departure (board passengers)
            if not is_last and stop.get('odjazd'):
                _process_stop_event(
                    'depart', kurs_id, city_id, forward_ids, is_last,
                    seat_caps, daily_demand, daily_transfer, current_transfer,
                    stop['odjazd'], next_city,
                    pricing=pricing, cities=cities, gapowicze_rate=gapowicze_rate,
                )

            if is_last:
                last_time = stop.get('przyjazd') or stop.get('odjazd') or '00:00'
                awaria = awarie.get(kurs_id, {})
                delay  = awaria.get('awariaTime', 0) if awaria.get('isAwaria') == 1 else 0
                daily_arrivals[kurs_id] = _add_delay(last_time, delay)

                kurs_hours       = kurs_duration / 60.0 if kurs_duration > 0 else 0.0
                total_passengers = (daily_transfer.get(kurs_id) or {}).get('total', 0)

                wars_rev = round(calc_wars_revenue(total_passengers, barmans_exp, base_rate=20))

                fake_stops = [{'city_id': cid} for cid in resolved_ids]
                min_seg_price = _calc_min_segment_price(fake_stops, cities)

                fine_rev = round(calc_fine_revenue(
                    passengers=total_passengers,
                    rate=gapowicze_rate,
                    n_cond=n_cond,
                    duration_min=kurs_duration,
                    penalty_min=penalty_min,
                    fine_multiplier=fine_multiplier,
                    min_segment_price=min_seg_price,
                ))
                inspection_idx = round(
                    calc_inspection_index(n_cond, total_passengers, kurs_hours, cond_cap_per_hour),
                    4,
                ) if kurs_hours > 0 else 0.0

                kt = daily_transfer.setdefault(kurs_id, {'od': {}, 'total': 0, 'class1': 0, 'class2': 0})
                kt['warsRevenue']    = wars_rev
                kt['fineRevenue']    = fine_rev
                kt['inspectionIndex'] = inspection_idx

    return daily_transfer, daily_arrivals


def run_boarding_rollover(db):
    """Simulate full game day for every eligible trainSet.

    Called once at game midnight (by _check_game_day_rollover) before
    save_daily_report so that dailyTransfer reflects the completed day.
    Writes dailyTransfer + dailyArrivals to each trainSet with _boardingWrite=True.
    """
    base_trains = _get_base_trains(db)
    cities      = _get_cities(db)

    config_snap = db.collection('gameSettings').document('config').get()
    game_config = config_snap.to_dict() or {} if config_snap.exists else {}

    write_batch = db.batch()
    batch_count = 0

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        player_trains = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/trains').stream()}
        player_doc    = p_doc.to_dict() or {}
        emp_map       = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/kadry').stream()}

        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            ts   = ts_doc.to_dict() or {}
            crew = ts.get('crew') or {}
            if not crew.get('maszynista') or not crew.get('kierownik'):
                continue
            if ts.get('speedMismatchBlock'):
                continue
            pricing = ts.get('pricing') or player_doc.get('defaultPricing') or DEFAULT_PRICING
            if not pricing or not pricing.get('class2Per100km'):
                continue
            if not ts.get('dailyDemand'):
                continue

            daily_transfer, daily_arrivals = _simulate_full_day_for_ts(
                ts, player_trains, base_trains, cities, pricing, emp_map, game_config,
            )

            write_batch.update(ts_doc.reference, {
                'dailyTransfer': daily_transfer,
                'dailyArrivals': daily_arrivals,
                '_boardingWrite': True,
            })
            batch_count += 1
            if batch_count % 400 == 0:
                write_batch.commit()
                write_batch = db.batch()

    if batch_count % 400 != 0:
        write_batch.commit()

    print(f'[ROLLOVER] Full-day boarding simulated for {batch_count} trainSets.')


def _clear_daily_boarding_state(db):
    """Reset dailyTransfer, currentTransfer, dailyArrivals for every trainSet.

    Called after save_daily_report + calc_demand_for_train_sets at game midnight
    so the new day starts with clean state. _boardingWrite=True prevents trigger cascade.
    """
    write_batch = db.batch()
    batch_count = 0

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            write_batch.update(ts_doc.reference, {
                'dailyTransfer':   {},
                'currentTransfer': {},
                'dailyArrivals':   {},
                '_boardingWrite':  True,
            })
            batch_count += 1
            if batch_count % 400 == 0:
                write_batch.commit()
                write_batch = db.batch()

    if batch_count % 400 != 0:
        write_batch.commit()

    print(f'[ROLLOVER] Cleared daily boarding state for {batch_count} trainSets.')
