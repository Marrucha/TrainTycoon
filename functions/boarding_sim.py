"""Train boarding simulation.

Architecture:
  1. rebuild_schedule_table() — builds a flat `rozkłady` collection once per
     day (or on demand).  Each document = one kurs for one trainSet:
       {player_id, ts_id, kurs_id, departure_times, arrival_times, stops[]}
     departure_times / arrival_times enable array_contains queries so the
     boarding tick never has to scan all trainSet documents.

  2. run_boarding_tick() — runs every minute.  Queries `rozkłady` twice:
       • departure_times array_contains now_str  →  ALIGHT + BOARD
       • arrival_times   array_contains now_str  →  ALIGHT only (arrival ≠ departure)
     Then groups matching docs by (player_id, ts_id), loads only those
     trainSet documents, mutates dailyDemand / dailyTransfer / currentTransfer
     in memory, and writes them back in a single batch.

rozkłady document schema
─────────────────────────
  player_id:        str          player document ID
  ts_id:            str          trainSet document ID
  kurs_id:          str          kurs identifier (stringified)
  departure_times:  list[str]    all "HH:MM" departure times in this kurs
  arrival_times:    list[str]    all "HH:MM" arrival times in this kurs
  stops:            list[dict]   ordered stop list:
    stop_index:  int
    city_id:     str
    odjazd:      str|None
    przyjazd:    str|None
    is_first:    bool
    is_last:     bool
    forward_ids: list[str]
"""

import math
from datetime import datetime
import zoneinfo

from utils import _find_city
from staff import calc_wars_revenue, calc_fine_revenue, calc_inspection_index

# Defaults for gameConfig fields (overridden by Firestore gameSettings/config)
_DEFAULT_FINE_MULTIPLIER   = 20
_DEFAULT_PENALTY_MIN       = 15
_DEFAULT_COND_CAP_PER_HOUR = 100
from schedule_builder import rebuild_schedule_for_trainset, rebuild_schedule_table
from tickets_pricing import _calc_min_segment_price, _DEFAULT_CLASS2_PER_100KM, _ticket_price_for_pair, DEFAULT_PRICING
def run_boarding_tick(db, now_str=None):
    """Process all boarding/alighting events. Supports Batch Processing of virtual minutes."""
    import time

    c_snap = db.collection('gameConfig').document('constants').get()
    consts = c_snap.to_dict() or {} if c_snap.exists else {}
    real_start_ms = consts.get('REAL_START_TIME_MS')
    game_start_ms = consts.get('GAME_START_TIME_MS')
    multiplier    = consts.get('TIME_MULTIPLIER', 30)

    # For testing or overrides
    if now_str is not None:
        minute_strings = [now_str]
    else:
        if not real_start_ms:
            return 0
        real_now_ms = int(time.time() * 1000)
        last_run_ms = consts.get('BOARDING_LAST_RUN_MS')
        
        # If running for the very first time, process only current minute
        if not last_run_ms:
            last_run_ms = real_now_ms - 60000

        if real_now_ms <= last_run_ms:
            return 0

        virt_start_ms = game_start_ms + (last_run_ms - real_start_ms) * multiplier
        virt_end_ms   = game_start_ms + (real_now_ms - real_start_ms) * multiplier

        minute_strings = []
        curr_ms = virt_start_ms + 60000
        while curr_ms <= virt_end_ms:
            dt = datetime.fromtimestamp(curr_ms / 1000.0, zoneinfo.ZoneInfo('Europe/Warsaw'))
            m_str = dt.strftime('%H:%M')
            if not minute_strings or minute_strings[-1] != m_str:
                minute_strings.append(m_str)
            curr_ms += 60000

        # Update last run time in DB
        db.collection('gameConfig').document('constants').update({'BOARDING_LAST_RUN_MS': real_now_ms})

    if not minute_strings:
        return 0

    print(f"Boarding tick batch processing {len(minute_strings)} minutes.")

    sched_ref = db.collection('rozkłady')
    base_trains = {d.id: d.to_dict() for d in db.collection('trains').stream()}
    cities = {d.id: d.to_dict() for d in db.collection('cities').stream()}

    config_snap = db.collection('gameSettings').document('config').get()
    game_config = config_snap.to_dict() or {} if config_snap.exists else {}
    fine_multiplier   = int(game_config.get('fineMultiplier', 20))
    penalty_min       = int(game_config.get('finePenaltyMinutes', 15))
    cond_cap_per_hour = int(game_config.get('conductorPassengersPerHour', 100))

    emp_cache = {}
    player_cache = {}

    affected_schedules = {}
    from itertools import islice
    
    def chunker(seq, size):
        return (seq[pos:pos + size] for pos in range(0, len(seq), size))
        
    for chunk in chunker(minute_strings, 10):
        # departures
        for doc in sched_ref.where('departure_times', 'array_contains_any', chunk).stream():
            affected_schedules[doc.id] = doc.to_dict()
        # arrivals
        for doc in sched_ref.where('arrival_times', 'array_contains_any', chunk).stream():
            affected_schedules[doc.id] = doc.to_dict()

    if not affected_schedules:
        return 0

    ts_cache = {}
    ts_refs = {}
    player_trains_cache = {}
    total_processed = 0

    for m_str in minute_strings:
        all_events = []
        for doc_id, data in affected_schedules.items():
            if m_str in data.get('departure_times', []):
                for stop in data.get('stops', []):
                    if stop.get('odjazd') == m_str:
                        all_events.append((data, stop, 'depart'))
            if m_str in data.get('arrival_times', []):
                for stop in data.get('stops', []):
                    if stop.get('przyjazd') == m_str and stop.get('odjazd') != m_str:
                        all_events.append((data, stop, 'arrive'))

        if not all_events:
            continue

        groups = {}
        for kurs_data, stop, ev_type in all_events:
            key = (kurs_data['player_id'], kurs_data['ts_id'])
            groups.setdefault(key, []).append((kurs_data, stop, ev_type))

        for (pid, ts_id), events in groups.items():
            if pid not in player_trains_cache:
                player_trains_cache[pid] = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/trains').stream()}

            player_trains = player_trains_cache[pid]

            if (pid, ts_id) not in ts_cache:
                ts_ref = db.collection(f'players/{pid}/trainSet').document(ts_id)
                ts_snap = ts_ref.get()
                if not ts_snap.exists:
                    continue
                ts_refs[(pid, ts_id)] = ts_ref
                ts_cache[(pid, ts_id)] = ts_snap.to_dict()

            if pid not in player_cache:
                p_snap = db.collection('players').document(pid).get()
                player_cache[pid] = p_snap.to_dict() or {} if p_snap.exists else {}

            ts = ts_cache[(pid, ts_id)]
            ts_name = ts.get('name', ts_id)
            crew = ts.get('crew') or {}
            pricing = ts.get('pricing') or player_cache[pid].get('defaultPricing')
            if not pricing or not pricing.get('class2Per100km') or not pricing.get('class1Per100km'):
                print(f'[SKIP] {ts_name} ({ts_id}): brak cennika')
                continue  # brak cennika — skład nie kursuje

            if not crew.get('maszynista') or not crew.get('kierownik'):
                print(f'[SKIP] {ts_name} ({ts_id}): brak maszynisty lub kierownika (crew={list(crew.keys())})')
                continue

            if ts.get('speedMismatchBlock'):
                print(f'[SKIP] {ts_name} ({ts_id}): speedMismatchBlock')
                continue

            dispatch_ms = ts.get('dispatchDate')
            if dispatch_ms:
                # We can calculate virt_now_ms for this minute based on m_str relative to virt_start_ms or just real_now_ms.
                # Since batching runs every 1 minute and spans roughly 30 minutes,
                # we can approximate using the current real_now_ms + virtual calculations.
                virt_now_ms = game_start_ms + (int(time.time() * 1000) - real_start_ms) * multiplier
                if virt_now_ms < dispatch_ms:
                    print(f'[SKIP] {ts_name} ({ts_id}): dispatchDate nie minął (virt_now={virt_now_ms}, dispatch={dispatch_ms})')
                    continue

            seat_caps = _calc_total_seats(ts, player_trains, base_trains)

            if 'dailyDemand' not in ts: ts['dailyDemand'] = {}
            if 'dailyTransfer' not in ts: ts['dailyTransfer'] = {}
            if 'currentTransfer' not in ts: ts['currentTransfer'] = {}
            if 'dailyArrivals' not in ts: ts['dailyArrivals'] = {}

            daily_demand = ts['dailyDemand']
            daily_transfer = ts['dailyTransfer']
            current_transfer = ts['currentTransfer']
            daily_arrivals = ts['dailyArrivals']
            awarie = ts.get('awarie') or {}
            gapowicze_rate = float(ts.get('gapowiczeRate', 0.0))

            if pid not in emp_cache:
                emp_cache[pid] = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/kadry').stream()}
            emp_map = emp_cache[pid]

            barman_id = crew.get('barman')
            barmans_exp = []
            if barman_id:
                b_emp = emp_map.get(barman_id, {})
                if not b_emp.get('isIntern'):
                    barmans_exp.append(float(b_emp.get('experience', 0.0)))

            cond_ids = crew.get('konduktorzy') or []
            n_cond = len(cond_ids)

            ev_order = {'arrive': 0, 'depart': 1}
            events.sort(key=lambda x: (x[1].get('stop_index', 0), ev_order.get(x[2], 0)))

            for kurs_data, stop, ev_type in events:
                kurs_id = str(kurs_data['kurs_id'])
                city_id = stop['city_id']
                raw_fwd = stop.get('forward_ids') or []
                forward_ids = set(raw_fwd)
                is_last = stop.get('is_last', False)
                next_city = raw_fwd[0] if raw_fwd else None

                _process_stop_event(
                    ev_type, kurs_id, city_id, forward_ids, is_last,
                    seat_caps, daily_demand, daily_transfer, current_transfer,
                    m_str, next_city_id=next_city,
                    pricing=pricing, cities=cities, gapowicze_rate=gapowicze_rate,
                )

                if is_last:
                    awaria = awarie.get(kurs_id, {})
                    delay = awaria.get('awariaTime', 0) if awaria.get('isAwaria') == 1 else 0
                    daily_arrivals[kurs_id] = _add_delay(m_str, delay)

                    kurs_stops = kurs_data.get('stops') or []
                    kurs_duration = int(kurs_data.get('kurs_duration_min') or 0)
                    kurs_hours = kurs_duration / 60.0 if kurs_duration > 0 else 0.0
                    total_passengers = (daily_transfer.get(kurs_id) or {}).get('total', 0)

                    wars_rev = round(calc_wars_revenue(total_passengers, barmans_exp, base_rate=20))
                    min_seg_price = _calc_min_segment_price(kurs_stops, cities)
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
                    kt['warsRevenue'] = wars_rev
                    kt['fineRevenue'] = fine_rev
                    kt['inspectionIndex'] = inspection_idx

                total_processed += 1

    write_batch = db.batch()
    batch_count = 0
    
    for (pid, ts_id), ts_data in ts_cache.items():
        ts_ref = ts_refs[(pid, ts_id)]
        write_batch.update(ts_ref, {
            'dailyDemand': ts_data.get('dailyDemand', {}),
            'dailyTransfer': ts_data.get('dailyTransfer', {}),
            'currentTransfer': ts_data.get('currentTransfer', {}),
            'dailyArrivals': ts_data.get('dailyArrivals', {}),
        })
        batch_count += 1
        if batch_count % 400 == 0:
            write_batch.commit()
            write_batch = db.batch()
            
    if batch_count % 400 != 0:
        write_batch.commit()

    print(f"Boarding tick completed. Processed {total_processed} events across {len(ts_cache)} trainSets.")
    return total_processed


# ---------------------------------------------------------------------------
# Per-event logic
# ---------------------------------------------------------------------------

def _process_stop_event(
    ev_type, kurs_id, city_id, forward_ids, is_last,
    seat_caps, daily_demand, daily_transfer, current_transfer,
    now_str, next_city_id,
    pricing=None, cities=None, gapowicze_rate=0.0,
):
    """Mutates daily_demand, daily_transfer, current_transfer in-place."""
    if pricing is None:
        pricing = DEFAULT_PRICING
    if cities is None:
        cities = {}

    kd          = daily_demand.get(kurs_id, {'od': {}, 'total': 0, 'class1': 0, 'class2': 0})
    od_demand   = kd['od']
    kt          = daily_transfer.setdefault(kurs_id, {'od': {}, 'total': 0, 'class1': 0, 'class2': 0})
    od_transfer = kt['od']
    kc          = current_transfer.setdefault(kurs_id, {'onBoard': {}, 'totalOnBoard': 0})
    on_board    = kc['onBoard']

    # ---- ALIGHT ----
    for key in list(on_board.keys()):
        dest_id = key.split(':')[1] if ':' in key else ''
        if dest_id == city_id:
            val   = on_board.pop(key)
            entry = od_transfer.setdefault(key, {'class1': 0, 'class2': 0})
            entry['class1'] += val.get('class1', 0)
            entry['class2'] += val.get('class2', 0)

    # ---- BOARD (only on departure events) ----
    if ev_type == 'depart' and not is_last and forward_ids:
        total_on_c1 = sum(v.get('class1', 0) for v in on_board.values())
        total_on_c2 = sum(v.get('class2', 0) for v in on_board.values())
        
        cap_c1 = max(0, seat_caps['class1'] - total_on_c1)
        cap_c2 = max(0, seat_caps['class2'] - total_on_c2)

        fwd = {
            k: v for k, v in od_demand.items()
            if k.startswith(city_id + ':')
            and (k.split(':')[1] if ':' in k else '') in forward_ids
        }

        print(f'[DEBUG] BOARD city={city_id} kurs={kurs_id} fwd_ids={sorted(forward_ids)} '
              f'demand_keys={sorted(od_demand.keys())} matched_fwd={sorted(fwd.keys())}')

        waiting_c1 = sum(v.get('class1', 0) for v in fwd.values())
        waiting_c2 = sum(v.get('class2', 0) for v in fwd.values())

        if (waiting_c1 > 0 and cap_c1 > 0) or (waiting_c2 > 0 and cap_c2 > 0):
            ratio_c1 = min(1.0, cap_c1 / waiting_c1) if waiting_c1 > 0 else 0
            ratio_c2 = min(1.0, cap_c2 / waiting_c2) if waiting_c2 > 0 else 0
            
            rem_c1 = cap_c1
            rem_c2 = cap_c2
            
            for key, val in fwd.items():
                if rem_c1 <= 0 and rem_c2 <= 0:
                    break
                    
                c1  = val.get('class1', 0)
                c2  = val.get('class2', 0)
                
                b1 = round(c1 * ratio_c1) if rem_c1 > 0 else 0
                b2 = round(c2 * ratio_c2) if rem_c2 > 0 else 0
                
                # strict capping just in case logic rounding acts up
                b1 = min(b1, rem_c1)
                b2 = min(b2, rem_c2)
                
                if b1 + b2 == 0:
                    continue

                from_id, to_id = key.split(':') if ':' in key else (key, '')
                p1 = _ticket_price_for_pair(from_id, to_id, pricing, cities, 1)
                p2 = _ticket_price_for_pair(from_id, to_id, pricing, cities, 2)
                pay_factor = 1.0 - gapowicze_rate
                rev_c1 = b1 * p1 * pay_factor
                rev_c2 = b2 * p2 * pay_factor
                kt['revenueC1'] = kt.get('revenueC1', 0) + rev_c1
                kt['revenueC2'] = kt.get('revenueC2', 0) + rev_c2
                kt['revenue']   = kt.get('revenue',   0) + rev_c1 + rev_c2

                entry = on_board.setdefault(key, {'class1': 0, 'class2': 0})
                entry['class1'] += b1
                entry['class2'] += b2
                od_demand[key] = {
                    'class1': max(0, c1 - b1),
                    'class2': max(0, c2 - b2),
                }
                rem_c1 -= b1
                rem_c2 -= b2

    # ---- UPDATE currentTransfer ----
    total_on_new = sum(v.get('class1', 0) + v.get('class2', 0) for v in on_board.values())
    
    if is_last:
        status = 'finished'
    elif ev_type == 'arrive':
        status = 'at_station'
    else:
        status = 'en_route'

    current_transfer[kurs_id] = {
        'onBoard':      {} if status == 'finished' else dict(on_board),
        'totalOnBoard': 0 if status == 'finished' else total_on_new,
        'lastStation':  city_id,
        'nextStation':  next_city_id if status == 'en_route' else None,
        'status':       status,
        'updatedAt':    now_str,
    }

    # ---- Recompute dailyDemand totals ----
    d_c1 = sum(v.get('class1', 0) for v in od_demand.values())
    d_c2 = sum(v.get('class2', 0) for v in od_demand.values())
    daily_demand[kurs_id] = {**kd, 'od': od_demand, 'total': d_c1 + d_c2, 'class1': d_c1, 'class2': d_c2}

    # ---- Recompute dailyTransfer totals ----
    t_c1 = sum(v.get('class1', 0) for v in od_transfer.values())
    t_c2 = sum(v.get('class2', 0) for v in od_transfer.values())
    daily_transfer[kurs_id] = {
        'od':         od_transfer,
        'total':      t_c1 + t_c2,
        'class1':     t_c1,
        'class2':     t_c2,
        'revenue':    kt.get('revenue',   0),
        'revenueC1':  kt.get('revenueC1', 0),
        'revenueC2':  kt.get('revenueC2', 0),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _calc_total_seats(ts, player_trains, base_trains):
    caps = {'class1': 0, 'class2': 0}
    for wagon_id in (ts.get('trainIds') or []):
        pw     = player_trains.get(wagon_id, {})
        bw     = base_trains.get(pw.get('parent_id', ''), {})
        
        cls_val = bw.get('class')
        if not cls_val:
            cls_val = pw.get('class', 2)
            
        cls_int = int(cls_val) if cls_val else 2
        seats = bw.get('seats', 0)
        
        if cls_int == 1:
            caps['class1'] += seats
        else:
            caps['class2'] += seats
            
    # Fallback to generic capacity if zero
    if caps['class1'] == 0 and caps['class2'] == 0:
        caps['class2'] = 200
        
    return caps


def _deep_copy_demand(m):
    return {kk: {**v, 'od': {ok: dict(ov) for ok, ov in v.get('od', {}).items()}}
            for kk, v in m.items()}


def _deep_copy_current(m):
    return {kk: {**v, 'onBoard': {ok: dict(ov) for ok, ov in v.get('onBoard', {}).items()}}
            for kk, v in m.items()}


def _add_delay(time_str, minutes):
    """Add minutes to 'HH:MM', wrapping past midnight."""
    if not minutes:
        return time_str
    h, m = map(int, time_str.split(':'))
    total = h * 60 + m + minutes
    return f'{(total // 60) % 24:02d}:{total % 60:02d}'
