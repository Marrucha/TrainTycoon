import re

NEW_CODE = """def run_boarding_tick(db, now_str=None):
    \"\"\"Process all boarding/alighting events. Supports Batch Processing of virtual minutes.\"\"\"
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

            ts = ts_cache[(pid, ts_id)]
            crew = ts.get('crew') or {}

            if not crew.get('maszynista') or not crew.get('kierownik'):
                continue

            if ts.get('speedMismatchBlock'):
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

            events.sort(key=lambda x: x[1].get('stop_index', 0))

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
"""

with open('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/boarding_sim.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Szukamy od def run_boarding_tick(db, now_str=None): aż do # --------------------------------------------------------------------------- (tuż przed per-event logic)
pattern = re.compile(r'def run_boarding_tick\s*\(db,\s*now_str=None\):.*?(?=# ---------------------------------------------------------------------------\n# Per-event logic)', re.DOTALL)
new_text = pattern.sub(NEW_CODE + '\n\n', text)

with open('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/boarding_sim.py', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Boarding tick patched!')
