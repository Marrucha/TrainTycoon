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
from tickets_pricing import _calc_min_segment_price, _DEFAULT_CLASS2_PER_100KM
def run_boarding_tick(db, now_str=None):
    """Process all boarding/alighting events at the current minute.

    Args:
        db:       Firestore client.
        now_str:  Override as "HH:MM" (for testing / manual backfill).
    Returns:
        Number of stop events processed.
    """
    if now_str is None:
        now_str = datetime.now(zoneinfo.ZoneInfo('Europe/Warsaw')).strftime('%H:%M')

    sched_ref   = db.collection('rozkłady')
    base_trains = {d.id: d.to_dict() for d in db.collection('trains').stream()}

    # Load cities once for min_segment_price calculation
    cities = {d.id: d.to_dict() for d in db.collection('cities').stream()}

    # Load gameConfig for fine/inspection parameters
    config_snap = db.collection('gameSettings').document('config').get()
    game_config = config_snap.to_dict() or {} if config_snap.exists else {}
    fine_multiplier   = int(game_config.get('fineMultiplier', 20))
    penalty_min       = int(game_config.get('finePenaltyMinutes', 15))
    cond_cap_per_hour = int(game_config.get('conductorPassengersPerHour', 100))
    c_snap = db.collection('gameConfig').document('constants').get()
    consts = c_snap.to_dict() or {} if c_snap.exists else {}

    # Cache employees per player (loaded on first encounter)
    emp_cache = {}   # pid → {emp_id: emp_dict}

    # ------------------------------------------------------------------
    # 1. Query kurs docs that have a departure or arrival at now_str
    # ------------------------------------------------------------------
    dep_docs = list(sched_ref.where('departure_times', 'array_contains', now_str).stream())
    arr_docs = list(sched_ref.where('arrival_times',   'array_contains', now_str).stream())

    # Build a unified event list: (kurs_doc_data, stop_dict, event_type)
    all_events = []
    seen_dep = set()

    for doc in dep_docs:
        data = doc.to_dict()
        seen_dep.add(doc.id)
        for stop in data.get('stops', []):
            if stop.get('odjazd') == now_str:
                all_events.append((data, stop, 'depart'))

    for doc in arr_docs:
        data = doc.to_dict()
        for stop in data.get('stops', []):
            przyjazd = stop.get('przyjazd')
            if przyjazd == now_str and stop.get('odjazd') != now_str:
                all_events.append((data, stop, 'arrive'))

    if not all_events:
        print(f'Boarding tick {now_str}: no events.')
        return 0

    # ------------------------------------------------------------------
    # 2. Group by (player_id, ts_id) to minimise Firestore reads
    # ------------------------------------------------------------------
    groups = {}   # (pid, ts_id) → list of (kurs_data, stop, ev_type)
    for kurs_data, stop, ev_type in all_events:
        key = (kurs_data['player_id'], kurs_data['ts_id'])
        groups.setdefault(key, []).append((kurs_data, stop, ev_type))

    # ------------------------------------------------------------------
    # 3. Load only the needed trainSet documents and process
    # ------------------------------------------------------------------
    processed   = 0
    write_batch = db.batch()

    for (pid, ts_id), events in groups.items():
        player_trains = {
            d.id: d.to_dict()
            for d in db.collection(f'players/{pid}/trains').stream()
        }

        ts_ref  = db.collection(f'players/{pid}/trainSet').document(ts_id)
        ts_snap = ts_ref.get()
        if not ts_snap.exists:
            continue

        ts    = ts_snap.to_dict()
        crew  = ts.get('crew') or {}

        # Require maszynista + kierownik to operate
        if not crew.get('maszynista') or not crew.get('kierownik'):
            print(f'Boarding tick {now_str}: skipping {pid}/{ts_id} – missing required crew.')
            continue

        # Skip if speed mismatch blocks operation (schedule outdated after wagon change)
        if ts.get('speedMismatchBlock'):
            print(f'Boarding tick {now_str}: skipping {pid}/{ts_id} – speedMismatchBlock.')
            continue

        seat_caps   = _calc_total_seats(ts, player_trains, base_trains)

        daily_demand     = _deep_copy_demand(ts.get('dailyDemand') or {})
        daily_transfer   = _deep_copy_demand(ts.get('dailyTransfer') or {})
        current_transfer = _deep_copy_current(ts.get('currentTransfer') or {})
        daily_arrivals   = dict(ts.get('dailyArrivals') or {})
        awarie           = ts.get('awarie') or {}
        gapowicze_rate   = float(ts.get('gapowiczeRate', 0.0))

        # Load employees for this player (cached)
        if pid not in emp_cache:
            emp_cache[pid] = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/kadry').stream()}
        emp_map = emp_cache[pid]

        # Resolve barman experience list
        barman_id    = crew.get('barman')
        barmans_exp  = []
        if barman_id:
            b_emp = emp_map.get(barman_id, {})
            if not b_emp.get('isIntern'):
                barmans_exp.append(float(b_emp.get('experience', 0.0)))

        # Conductor count
        cond_ids = crew.get('konduktorzy') or []
        n_cond   = len(cond_ids)

        # Sort by stop_index so multi-stop same-minute cases are ordered
        events.sort(key=lambda x: x[1].get('stop_index', 0))

        for kurs_data, stop, ev_type in events:
            kurs_id       = str(kurs_data['kurs_id'])   # demand keys are always str
            city_id       = stop['city_id']
            raw_fwd       = stop.get('forward_ids') or []
            forward_ids   = set(raw_fwd)
            is_last       = stop.get('is_last', False)
            next_city     = raw_fwd[0] if raw_fwd else None

            _process_stop_event(
                ev_type, kurs_id, city_id, forward_ids, is_last,
                seat_caps, daily_demand, daily_transfer, current_transfer,
                now_str, next_city_id=next_city,
            )

            if is_last:
                awaria = awarie.get(kurs_id, {})
                delay = awaria.get('awariaTime', 0) if awaria.get('isAwaria') == 1 else 0
                daily_arrivals[kurs_id] = _add_delay(now_str, delay)

                # --- Per-kurs revenue calculations ---
                kurs_stops       = kurs_data.get('stops') or []
                kurs_duration    = int(kurs_data.get('kurs_duration_min') or 0)
                kurs_hours       = kurs_duration / 60.0 if kurs_duration > 0 else 0.0
                total_passengers = (daily_transfer.get(kurs_id) or {}).get('total', 0)

                # Wars (restaurant car) revenue
                wars_rev = round(calc_wars_revenue(total_passengers, barmans_exp, base_rate=20))

                # Fine revenue
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

                # Inspection index
                inspection_idx = round(
                    calc_inspection_index(n_cond, total_passengers, kurs_hours, cond_cap_per_hour),
                    4,
                ) if kurs_hours > 0 else 0.0

                # Attach to daily_transfer entry
                kt = daily_transfer.setdefault(kurs_id, {'od': {}, 'total': 0, 'class1': 0, 'class2': 0})
                kt['warsRevenue']    = wars_rev
                kt['fineRevenue']    = fine_rev
                kt['inspectionIndex'] = inspection_idx

            processed += 1

        write_batch.update(ts_ref, {
            'dailyDemand':     daily_demand,
            'dailyTransfer':   daily_transfer,
            'currentTransfer': current_transfer,
            'dailyArrivals':   daily_arrivals,
        })

    write_batch.commit()
    print(f'Boarding tick {now_str}: {processed} stop event(s) across '
          f'{len(groups)} trainSet(s).')
    return processed


# ---------------------------------------------------------------------------
# Per-event logic
# ---------------------------------------------------------------------------

def _process_stop_event(
    ev_type, kurs_id, city_id, forward_ids, is_last,
    seat_caps, daily_demand, daily_transfer, current_transfer,
    now_str, next_city_id,
):
    """Mutates daily_demand, daily_transfer, current_transfer in-place."""

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
    daily_transfer[kurs_id] = {'od': od_transfer, 'total': t_c1 + t_c2, 'class1': t_c1, 'class2': t_c2}


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
