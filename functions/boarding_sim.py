"""Train boarding simulation.

Architecture:
  1. rebuild_schedule_table() — builds a flat `rozkłady` collection once per
     day (or on demand).  Each document = one stop for one kurs, containing
     pre-resolved city IDs and forward_ids so the boarding tick never has to
     scan the full trainSet rozklad.

  2. run_boarding_tick() — runs every minute.  Queries `rozkłady` twice:
       • odjazd  == now_str  →  ALIGHT + BOARD  (train departs this stop)
       • przyjazd == now_str  AND przyjazd != odjazd  →  ALIGHT only
         (train arrives; passengers disembark before dwell time ends)
     Then groups matching records by (player_id, ts_id), loads only those
     trainSet documents, mutates dailyDemand / dailyTransfer / currentTransfer
     in memory, and writes them back in a single batch.

rozkłady document schema
─────────────────────────
  player_id:   str        player document ID
  ts_id:       str        trainSet document ID
  kurs_id:     str        kurs identifier (stringified)
  stop_index:  int        position in sorted stop list for this kurs
  city_id:     str        resolved city ID
  odjazd:      str|None   "HH:MM" departure from this stop (None = last stop)
  przyjazd:    str|None   "HH:MM" arrival at this stop   (None = first stop)
  is_first:    bool
  is_last:     bool
  forward_ids: list[str]  city IDs of all stops after this one
"""

from datetime import datetime

from utils import _find_city


# ---------------------------------------------------------------------------
# Schedule table builder — full rebuild and per-trainSet partial rebuild
# ---------------------------------------------------------------------------

def rebuild_schedule_for_trainset(db, pid, ts_id, ts_data):
    """Rebuild rozkłady records for a single trainSet.

    Called by the Firestore trigger on_trainset_written.
    Deletes all existing records for (pid, ts_id) and writes new ones.
    If ts_data is None (document deleted), only the deletion happens.

    Returns number of records written.
    """
    cities = {d.id: d.to_dict() for d in db.collection('cities').stream()}

    def resolve(miasto):
        _, cid = _find_city(cities, miasto)
        return cid if cid else miasto

    sched_ref = db.collection('rozkłady')

    # Delete existing records for this (pid, ts_id).
    # Uses compound query — requires a composite index on (player_id, ts_id).
    existing = list(
        sched_ref
        .where('player_id', '==', pid)
        .where('ts_id', '==', ts_id)
        .stream()
    )
    if existing:
        del_batch = db.batch()
        for doc in existing:
            del_batch.delete(doc.reference)
        del_batch.commit()

    if not ts_data:
        return 0  # trainSet deleted — nothing to rebuild

    rozklad = ts_data.get('rozklad') or []
    if not rozklad:
        return 0

    by_kurs = _group_by_kurs_raw(rozklad)
    batch   = db.batch()
    written = 0

    for kurs_id, stops in by_kurs.items():
        resolved = [resolve(s.get('miasto', '')) for s in stops]
        n = len(stops)

        for i, (stop, city_id) in enumerate(zip(stops, resolved)):
            odjazd   = stop.get('odjazd') or None
            przyjazd = stop.get('przyjazd') or None
            is_last  = (i == n - 1)
            is_first = (i == 0)

            if is_last and not odjazd and przyjazd:
                odjazd = przyjazd   # terminal stop: use arrival as event time

            doc_id = f'{pid}__{ts_id}__{kurs_id}__{i:03d}'
            batch.set(sched_ref.document(doc_id), {
                'player_id':   pid,
                'ts_id':       ts_id,
                'kurs_id':     kurs_id,
                'stop_index':  i,
                'city_id':     city_id,
                'odjazd':      odjazd,
                'przyjazd':    przyjazd,
                'is_first':    is_first,
                'is_last':     is_last,
                'forward_ids': resolved[i + 1:],
            })
            written += 1

            if written % 499 == 0:
                batch.commit()
                batch = db.batch()

    batch.commit()
    print(f'Schedule rebuilt for {pid}/{ts_id}: {written} records.')
    return written


def rebuild_schedule_table(db):
    """Rebuild the entire `rozkłady` collection for all players.

    Called once per day after calc_demand_for_train_sets(), and available
    as an HTTP trigger for manual full rebuilds.
    Delegates per-trainSet work to rebuild_schedule_for_trainset().
    """
    total = 0
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            total += rebuild_schedule_for_trainset(db, pid, ts_doc.id, ts_doc.to_dict())

    print(f'Full schedule table rebuild: {total} records total.')
    return total


# ---------------------------------------------------------------------------
# Boarding tick
# ---------------------------------------------------------------------------

def run_boarding_tick(db, now_str=None):
    """Process all boarding/alighting events at the current minute.

    Args:
        db:       Firestore client.
        now_str:  Override as "HH:MM" (for testing / manual backfill).
    Returns:
        Number of stop events processed.
    """
    if now_str is None:
        now_str = datetime.now().strftime('%H:%M')

    sched_ref  = db.collection('rozkłady')
    base_trains = {d.id: d.to_dict() for d in db.collection('trains').stream()}

    # ------------------------------------------------------------------
    # 1. Query: stops where train departs now (primary event: alight + board)
    # ------------------------------------------------------------------
    dep_events  = list(sched_ref.where('odjazd', '==', now_str).stream())

    # Query: stops where train arrives now AND arrival ≠ departure
    #        (secondary event: alight only, before dwell ends)
    arr_events  = list(sched_ref.where('przyjazd', '==', now_str).stream())
    arr_only    = [e for e in arr_events
                   if e.to_dict().get('odjazd') != now_str]

    all_events  = [(e, 'depart') for e in dep_events] + \
                  [(e, 'arrive') for e in arr_only]

    if not all_events:
        print(f'Boarding tick {now_str}: no events.')
        return 0

    # ------------------------------------------------------------------
    # 2. Group events by (player_id, ts_id) to minimise Firestore reads
    # ------------------------------------------------------------------
    groups = {}   # (pid, ts_id) → list of (event_doc, event_type)
    for ev_doc, ev_type in all_events:
        ev = ev_doc.to_dict()
        key = (ev['player_id'], ev['ts_id'])
        groups.setdefault(key, []).append((ev, ev_type))

    # ------------------------------------------------------------------
    # 3. Load only the needed trainSet documents
    # ------------------------------------------------------------------
    processed = 0
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

        ts           = ts_snap.to_dict()
        total_seats  = _calc_total_seats(ts, player_trains, base_trains)

        # Deep-copy mutable state
        daily_demand     = _deep_copy_demand(ts.get('dailyDemand') or {})
        daily_transfer   = _deep_copy_demand(ts.get('dailyTransfer') or {})
        current_transfer = _deep_copy_current(ts.get('currentTransfer') or {})

        # Sort events by stop_index so multi-stop same-minute cases are ordered
        events.sort(key=lambda x: x[0].get('stop_index', 0))

        for ev, ev_type in events:
            kurs_id     = ev['kurs_id']
            city_id     = ev['city_id']
            forward_ids = set(ev.get('forward_ids') or [])
            is_last     = ev.get('is_last', False)

            _process_stop_event(
                ev_type, kurs_id, city_id, forward_ids, is_last,
                total_seats, daily_demand, daily_transfer, current_transfer,
                now_str,
                next_city_id=forward_ids.__iter__().__next__() if forward_ids else None,
            )
            processed += 1

        write_batch.update(ts_ref, {
            'dailyDemand':     daily_demand,
            'dailyTransfer':   daily_transfer,
            'currentTransfer': current_transfer,
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
    total_seats, daily_demand, daily_transfer, current_transfer,
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
    # Always alight passengers whose destination is this city
    for key in list(on_board.keys()):
        dest_id = key.split(':')[1] if ':' in key else ''
        if dest_id == city_id:
            val   = on_board.pop(key)
            entry = od_transfer.setdefault(key, {'class1': 0, 'class2': 0})
            entry['class1'] += val.get('class1', 0)
            entry['class2'] += val.get('class2', 0)

    # ---- BOARD (only on departure events) ----
    if ev_type == 'depart' and not is_last and forward_ids:
        total_on = sum(v.get('class1', 0) + v.get('class2', 0) for v in on_board.values())
        capacity = max(0, total_seats - total_on)

        fwd = {
            k: v for k, v in od_demand.items()
            if k.startswith(city_id + ':')
            and (k.split(':')[1] if ':' in k else '') in forward_ids
        }
        total_waiting = sum(v.get('class1', 0) + v.get('class2', 0) for v in fwd.values())

        if total_waiting > 0 and capacity > 0:
            ratio = min(1.0, capacity / total_waiting)
            for key, val in fwd.items():
                c1  = val.get('class1', 0)
                c2  = val.get('class2', 0)
                b1  = round(c1 * ratio)
                b2  = round(c2 * ratio)
                if b1 + b2 == 0:
                    continue
                entry = on_board.setdefault(key, {'class1': 0, 'class2': 0})
                entry['class1'] += b1
                entry['class2'] += b2
                od_demand[key] = {
                    'class1': max(0, c1 - b1),
                    'class2': max(0, c2 - b2),
                }

    # ---- UPDATE currentTransfer ----
    total_on_new = sum(v.get('class1', 0) + v.get('class2', 0) for v in on_board.values())
    status       = 'finished' if (is_last or ev_type == 'arrive') else 'en_route'

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

def _group_by_kurs_raw(rozklad):
    """Group raw rozklad stops by kurs, sorted by odjazd/przyjazd time."""
    by_kurs = {}
    for stop in rozklad:
        k = stop.get('kurs')
        if k is None:
            continue
        by_kurs.setdefault(str(k), []).append(stop)
    for k in by_kurs:
        by_kurs[k].sort(key=lambda s: s.get('odjazd') or s.get('przyjazd') or '')
    return by_kurs


def _calc_total_seats(ts, player_trains, base_trains):
    total = 0
    for wagon_id in (ts.get('trainIds') or []):
        pw     = player_trains.get(wagon_id, {})
        bw     = base_trains.get(pw.get('parent_id', ''), {})
        total += bw.get('seats', 0)
    return total if total > 0 else 200


def _deep_copy_demand(m):
    return {kk: {**v, 'od': {ok: dict(ov) for ok, ov in v.get('od', {}).items()}}
            for kk, v in m.items()}


def _deep_copy_current(m):
    return {kk: {**v, 'onBoard': {ok: dict(ov) for ok, ov in v.get('onBoard', {}).items()}}
            for kk, v in m.items()}
