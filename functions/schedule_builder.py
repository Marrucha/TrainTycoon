"""Builds a flat 'rozkłady' collection for efficient querying by the boarding tick."""
from utils import _find_city

def _time_diff_minutes(t1, t2):
    """Minutes from t1 to t2 (HH:MM), handling overnight wrap."""
    if not t1 or not t2 or t1 == '—' or t2 == '—':
        return 0
    h1, m1 = map(int, t1.split(':'))
    h2, m2 = map(int, t2.split(':'))
    diff = (h2 * 60 + m2) - (h1 * 60 + m1)
    return diff if diff >= 0 else diff + 24 * 60

def _group_by_kurs_raw(rozklad):
    """Group raw rozklad stops by kurs, maintaining their original order."""
    by_kurs = {}
    for stop in rozklad:
        k = stop.get('kurs')
        if k is None:
            continue
        by_kurs.setdefault(str(k), []).append(stop)
    return by_kurs

def rebuild_schedule_for_trainset(db, pid, ts_id, ts_data, cities=None):
    """Rebuild rozkłady records for a single trainSet.

    Called by the Firestore trigger on_trainset_written.
    Deletes all existing records for (pid, ts_id) using deterministic IDs
    and writes new ones — one document per kurs.
    If ts_data is None (document deleted), only the deletion happens.

    Accepts optional pre-loaded ``cities`` dict to avoid a repeated Firestore
    stream when called in a loop (e.g. from rebuild_schedule_table).

    Returns number of kurs documents written.
    """
    if cities is None:
        cities = {d.id: d.to_dict() for d in db.collection('cities').stream()}

    def resolve(miasto):
        _, cid = _find_city(cities, miasto)
        return cid if cid else miasto

    sched_ref = db.collection('rozkłady')

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
        return 0

    rozklad = ts_data.get('rozklad') or []
    if not rozklad:
        return 0

    by_kurs = _group_by_kurs_raw(rozklad)
    batch   = db.batch()
    written = 0

    for kurs_id, raw_stops in by_kurs.items():
        resolved = [resolve(s.get('miasto', '')) for s in raw_stops]
        n = len(raw_stops)

        stops = []
        departure_times = []
        arrival_times   = []

        for i, (stop, city_id) in enumerate(zip(raw_stops, resolved)):
            odjazd   = stop.get('odjazd') or None
            przyjazd = stop.get('przyjazd') or None
            is_last  = (i == n - 1)
            is_first = (i == 0)

            if is_last and not odjazd and przyjazd:
                odjazd = przyjazd

            if odjazd:
                departure_times.append(odjazd)
            if przyjazd and przyjazd != odjazd:
                arrival_times.append(przyjazd)

            stops.append({
                'stop_index':  i,
                'city_id':     city_id,
                'odjazd':      odjazd,
                'przyjazd':    przyjazd,
                'is_first':    is_first,
                'is_last':     is_last,
                'forward_ids': resolved[i + 1:],
            })

        first_dep = stops[0].get('odjazd') if stops else None
        last_arr  = stops[-1].get('przyjazd') if stops else None
        kurs_duration_min = _time_diff_minutes(first_dep, last_arr)

        doc_id = f'{pid}__{ts_id}__{kurs_id}'
        batch.set(sched_ref.document(doc_id), {
            'player_id':         pid,
            'ts_id':             ts_id,
            'kurs_id':           kurs_id,
            'departure_times':   departure_times,
            'arrival_times':     arrival_times,
            'stops':             stops,
            'kurs_duration_min': kurs_duration_min,
        })
        written += 1

        if written % 499 == 0:
            batch.commit()
            batch = db.batch()

    batch.commit()
    print(f'Schedule rebuilt for {pid}/{ts_id}: {written} kurs doc(s).')
    return written

def rebuild_schedule_table(db):
    """Rebuild the entire `rozkłady` collection for all players."""
    # Pobierz cities raz dla całego przebiegu zamiast per trainSet
    cities = {d.id: d.to_dict() for d in db.collection('cities').stream()}
    total = 0
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            total += rebuild_schedule_for_trainset(db, pid, ts_doc.id, ts_doc.to_dict(), cities=cities)

    print(f'Full schedule table rebuild: {total} kurs doc(s) total.')
    return total
