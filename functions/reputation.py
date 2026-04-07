import math
from datetime import datetime, timezone, timedelta
from reports import _calc_ticket_price, DEFAULT_PRICING
from staff import calc_raw_comfort

def update_reputation_metrics(db):
    """Entry point to calculate and update all player reputation components using EMA."""
    import zoneinfo
    now_waw = datetime.now(zoneinfo.ZoneInfo('Europe/Warsaw'))
    date_str = now_waw.strftime('%Y-%m-%d')
    
    routes_col = db.collection('routes').stream()
    routes = [r.to_dict() for r in routes_col]
    sam_snap = db.collection('players').document('samorządowy').get()
    sam_data = sam_snap.to_dict() or {}
    
    cities_col = db.collection('cities').stream()
    cities_map = {c.id: c.to_dict() for c in cities_col}
    for cid, d in list(cities_map.items()): 
        if d.get('name'): cities_map[d['name']] = d

    players = db.collection('players').stream()
    for p_doc in players:
        pid = p_doc.id
        if pid == 'samorządowy': continue
        
        p_data = p_doc.to_dict() or {}
        old_details = p_data.get('reputationDetails', {})
        new_details = {}
        
        # --- A. PRICE REPUTATION (RAW) ---
        raw_price = _calc_raw_price_score(db, pid, p_data, routes, sam_data)
        new_details['priceScore'] = _apply_ema(old_details.get('priceScore'), raw_price)
        
        # --- B. MODERNITY REPUTATION (RAW) ---
        raw_modernity = _calc_raw_modernity_score(db, pid)
        new_details['modernityScore'] = _apply_ema(old_details.get('modernityScore'), raw_modernity)
        
        # --- C. FILL RATE REPUTATION (RAW) ---
        raw_fill_rate, raw_fill_perc = _calc_raw_fill_rate_score(db, pid, date_str, now_waw)
        new_details['fillRateScore'] = _apply_ema(old_details.get('fillRateScore'), raw_fill_rate)
        new_details['fillRatePercent'] = raw_fill_perc
        
        # --- D. STABILITY REPUTATION (RAW) ---
        raw_stability = _calc_raw_stability_score(db, pid)
        new_details['stabilityScore'] = _apply_ema(old_details.get('stabilityScore'), raw_stability)
        # Clear dailyActions after calculation
        _clear_daily_actions(db, pid)
        
        # --- E. PUNCTUALITY ---
        raw_punct = _calc_raw_punctuality_score(db, pid, date_str, now_waw)
        if raw_punct is None:
            new_details['punctualityScore'] = old_details.get('punctualityScore', 10.0)
        else:
            new_details['punctualityScore'] = max(0.0, _apply_ema(old_details.get('punctualityScore'), raw_punct))

        # --- F. SPEED REPUTATION (RAW, max 10) ---
        raw_speed = _calc_raw_speed_score(db, pid, date_str, now_waw, sam_data.get('speedKmh', 80))
        new_details['speedScore'] = _apply_ema(old_details.get('speedScore'), raw_speed)

        # --- G. COMFORT REPUTATION (RAW, max 10) ---
        raw_comfort = _calc_raw_comfort_score(db, pid, date_str, now_waw)
        new_details['comfortScore'] = _apply_ema(old_details.get('comfortScore'), raw_comfort)

        _finalize_player_reputation(p_doc.reference, new_details, old_details)

def _apply_ema(old_val, raw_val):
    if old_val is None: return float(raw_val)
    return (float(old_val) * 0.99) + (float(raw_val) * 0.01)

def _finalize_player_reputation(ref, details, prev_details=None):
    # Max scores: punctuality(20) + stability(10) + modernity(10) +
    #             price(20) + fillRate(20) + speed(10) + comfort(10) = 100
    total_pts = sum([
        details.get('punctualityScore', 10.0),
        details.get('stabilityScore', 5.0),
        details.get('modernityScore', 5.0),
        details.get('priceScore', 10.0),
        details.get('fillRateScore', 10.0),
        details.get('speedScore', 5.0),
        details.get('comfortScore', 5.0),
    ])
    update_data = {
        'reputationDetails': details,
        'reputation': total_pts / 100,
    }
    if prev_details is not None:
        update_data['reputationDetailsPrev'] = prev_details
    ref.update(update_data)

def _calc_raw_stability_score(db, pid):
    actions_ref = db.collection(f'players/{pid}/dailyActions')
    actions = list(actions_ref.stream())
    sum_changes = sum(doc.to_dict().get('weight', 1) for doc in actions)
    
    # Count total active trainSets
    ts_count = 0
    for _ in db.collection(f'players/{pid}/trainSet').stream():
        ts_count += 1
        
    if ts_count == 0: return 10.0
    ratio = sum_changes / ts_count
    score = 10 * (1 - ratio)
    return max(0.0, min(10.0, score))

def _clear_daily_actions(db, pid):
    actions_ref = db.collection(f'players/{pid}/dailyActions')
    batch = db.batch()
    docs = list(actions_ref.stream())
    for doc in docs:
        batch.delete(doc.reference)
    batch.commit()

def _calc_raw_price_score(db, pid, p_data, routes, sam_data):
    if not routes: return 10.0
    our_pricing = p_data.get('defaultPricing', DEFAULT_PRICING)
    our_m = our_pricing.get('multipliers', DEFAULT_PRICING['multipliers'])
    our_c2 = our_pricing.get('class2Per100km', DEFAULT_PRICING['class2Per100km'])
    our_c1 = our_pricing.get('class1Per100km', DEFAULT_PRICING['class1Per100km'])

    # samorządowy stores flat fields (priceClass2Per100km) with optional priceDropRate per 100km
    sam_c2 = sam_data.get('priceClass2Per100km')
    sam_c1 = sam_data.get('priceClass1Per100km')
    drop = sam_data.get('priceDropRate', 0.0)
    sam_m = [(1.0 - drop) ** i for i in range(20)]

    if not sam_c2: return 10.0

    sum_r2 = count2 = 0
    sum_r1 = count1 = 0
    for r in routes:
        dist = r.get('distance')
        if not dist or dist <= 0: continue
        o2 = _calc_ticket_price(dist, our_c2, our_m)
        s2 = _calc_ticket_price(dist, sam_c2, sam_m)
        if s2 > 0:
            sum_r2 += o2 / s2
            count2 += 1
        if sam_c1:
            o1 = _calc_ticket_price(dist, our_c1, our_m)
            s1 = _calc_ticket_price(dist, sam_c1, sam_m)
            if s1 > 0:
                sum_r1 += o1 / s1
                count1 += 1

    if count2 == 0: return 10.0
    score_c2 = max(0.0, min(20.0, -10 * math.log2(max(0.01, sum_r2 / count2)) + 10))
    # jeśli samorządowy nie ma klasy 1, gracz dostaje automatycznie max za tę klasę
    score_c1 = max(0.0, min(20.0, -10 * math.log2(max(0.01, sum_r1 / count1)) + 10)) if count1 > 0 else 20.0
    return score_c2 * 0.8 + score_c1 * 0.2

def _calc_raw_modernity_score(db, pid):
    active_ids = set()
    for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
        active_ids.update(ts_doc.to_dict().get('trainIds', []))
    if not active_ids: return 0.0
    now = datetime.now(timezone.utc)
    equiv_ages = []
    # Pobierz wszystkie wagony gracza jednym stream() zamiast N oddzielnych get()
    all_trains = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/trains').stream()}
    for tid in active_ids:
        t = all_trains.get(tid)
        if not t: continue
        p_at = t.get('purchasedAt') or now.isoformat()
        dt_p = datetime.fromisoformat(p_at.replace('Z', '+00:00'))
        actual_age = max(0, (now - dt_p).total_seconds() / (365.25 * 3600 * 24))
        lm_at = t.get('lastMaintenance') or p_at
        dt_m = datetime.fromisoformat(lm_at.replace('Z', '+00:00'))
        days_since_m = max(0, (now - dt_m).total_seconds() / 86400)
        eff = max(0.1, 1.0 - (days_since_m / 365.25) * 0.5)
        equiv_ages.append(actual_age / eff)
    if not equiv_ages: return 0.0
    avg_age = sum(equiv_ages) / len(equiv_ages)
    return max(0, min(10, 10 - (avg_age * 0.25)))

def _calc_raw_fill_rate_score(db, pid, date_str, now_waw):
    report_snap = db.collection(f'players/{pid}/Raporty').document(date_str).get()
    if not report_snap.exists:
        yst_str = (now_waw - timedelta(days=1)).strftime('%Y-%m-%d')
        report_snap = db.collection(f'players/{pid}/Raporty').document(yst_str).get()
    if not report_snap.exists: return 0.0, 0.0
    ts_agg = report_snap.to_dict().get('trainSets') or {}
    total_tr = total_dm = 0
    for ts in ts_agg.values():
        d = ts.get('daily', {})
        total_tr += d.get('transferred', {}).get('total', 0)
        total_dm += d.get('totalDemand', {}).get('total', 0)
    if total_dm <= 0: return 0.0, 0.0
    perc = (total_tr / total_dm) * 100
    score = 20 - ((100 - perc) / 4.5)
    return max(0, min(20, score)), perc

def _calc_raw_punctuality_score(db, pid, date_str, now_waw):
    """
    Per kurs:
      delay <= 0 min  →  +0.5  (punktualny)
      delay > 0 min   →  -floor(delay / 5) * 0.5  (kara za każde pełne 5 min)

    avg_indicator = mean(scores)
    modifier = (avg_indicator + 0.5) * 20, clamp [0, 20]
      avg=+0.5 (wszystkie punktualne) → 20 pkt
      avg=-0.5                        →  0 pkt
      avg=-1.0 (śr. 10 min spóźn.)   → -10 (EMA ciągnie w dół)

    Zwraca None gdy brak danych → stary wynik bez zmian.
    """
    report_snap = db.collection(f'players/{pid}/Raporty').document(date_str).get()
    if not report_snap.exists:
        yst_str = (now_waw - timedelta(days=1)).strftime('%Y-%m-%d')
        report_snap = db.collection(f'players/{pid}/Raporty').document(yst_str).get()
    if not report_snap.exists:
        return None

    ts_agg = report_snap.to_dict().get('trainSets') or {}
    scores = []
    for ts in ts_agg.values():
        for kurs in ts.get('kursy', {}).values():
            delay = kurs.get('delayMin')
            if delay is None:
                continue
            if delay <= 0:
                scores.append(0.5)
            else:
                scores.append(-math.floor(delay / 5) * 0.5)

    if not scores:
        return None

    avg_indicator = sum(scores) / len(scores)
    modifier = (avg_indicator + 0.5) * 20
    return max(0.0, min(20.0, modifier))


def _calc_raw_speed_score(db, pid, date_str, now_waw, sam_speed_kmh):
    report_snap = db.collection(f'players/{pid}/Raporty').document(date_str).get()
    if not report_snap.exists:
        yst_str = (now_waw - timedelta(days=1)).strftime('%Y-%m-%d')
        report_snap = db.collection(f'players/{pid}/Raporty').document(yst_str).get()
    if not report_snap.exists: return 10.0
    ts_agg = report_snap.to_dict().get('trainSets') or {}
    speeds = []
    for ts in ts_agg.values():
        for kurs in ts.get('kursy', {}).values():
            speed = kurs.get('commercialSpeedKmh')
            if speed and speed > 0:
                speeds.append(speed)
    if not speeds: return 5.0
    avg_speed = sum(speeds) / len(speeds)
    x = sam_speed_kmh / avg_speed   # <1 means we're faster → better score
    score = -5 * math.log2(max(0.01, x)) + 5
    return max(0.0, min(10.0, score))

def _calc_raw_comfort_score(db, pid, date_str, now_waw):
    """Comfort score (0–10) based on average inspection index from today's report.

    idx=0  → 10 pts (no inspections)
    idx=1  →  5 pts (neutral)
    idx≥2  →  0 pts (over-inspected)
    """
    report_snap = db.collection(f'players/{pid}/Raporty').document(date_str).get()
    if not report_snap.exists:
        yst_str = (now_waw - timedelta(days=1)).strftime('%Y-%m-%d')
        report_snap = db.collection(f'players/{pid}/Raporty').document(yst_str).get()
    if not report_snap.exists:
        return 5.0  # neutral default

    ts_agg = report_snap.to_dict().get('trainSets') or {}
    indices = []
    for ts_info in ts_agg.values():
        for kurs in ts_info.get('kursy', {}).values():
            idx = kurs.get('inspectionIndex')
            if idx is not None:
                indices.append(float(idx))

    if not indices:
        return 5.0

    avg_idx = sum(indices) / len(indices)
    return calc_raw_comfort(avg_idx)


def update_price_reputation(db): update_reputation_metrics(db)
def update_modernity_reputation(db): update_reputation_metrics(db)
def update_fill_rate_reputation(db): update_reputation_metrics(db)
