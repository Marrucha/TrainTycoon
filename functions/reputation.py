import math
from datetime import datetime, timezone, timedelta
from reports import _calc_ticket_price, DEFAULT_PRICING

def update_reputation_metrics(db):
    """Entry point to calculate and update all player reputation components using EMA."""
    import zoneinfo
    now_waw = datetime.now(zoneinfo.ZoneInfo('Europe/Warsaw'))
    date_str = now_waw.strftime('%Y-%m-%d')
    
    routes_col = db.collection('routes').stream()
    routes = [r.to_dict() for r in routes_col]
    sam_snap = db.collection('players').document('samorządowy').get()
    sam_pricing = (sam_snap.to_dict() or {}).get('defaultPricing', DEFAULT_PRICING)
    
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
        raw_price = _calc_raw_price_score(db, pid, p_data, routes, sam_pricing)
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
        
        # --- E. PUNCTUALITY PLACEHOLDER ---
        raw_punct = old_details.get('punctualityScore', 10.0)
        new_details['punctualityScore'] = _apply_ema(old_details.get('punctualityScore'), raw_punct)
            
        _finalize_player_reputation(p_doc.reference, new_details)

def _apply_ema(old_val, raw_val):
    if old_val is None: return round(float(raw_val), 3)
    return round((float(old_val) * 0.99) + (float(raw_val) * 0.01), 3)

def _finalize_player_reputation(ref, details):
    total_pts = sum([
        details.get('punctualityScore', 10.0),
        details.get('stabilityScore', 10.0),
        details.get('modernityScore', 10.0),
        details.get('priceScore', 10.0),
        details.get('fillRateScore', 10.0)
    ])
    ref.update({
        'reputationDetails': details,
        'reputation': round(total_pts / 100, 4)
    })

def _calc_raw_stability_score(db, pid):
    actions_ref = db.collection(f'players/{pid}/dailyActions')
    actions = list(actions_ref.stream())
    sum_changes = sum(doc.to_dict().get('weight', 1) for doc in actions)
    
    # Count total active trainSets
    ts_count = 0
    for _ in db.collection(f'players/{pid}/trainSet').stream():
        ts_count += 1
        
    if ts_count == 0: return 20.0
    ratio = sum_changes / ts_count
    score = 20 * (1 - ratio)
    return max(0.0, score)

def _clear_daily_actions(db, pid):
    actions_ref = db.collection(f'players/{pid}/dailyActions')
    batch = db.batch()
    docs = list(actions_ref.stream())
    for doc in docs:
        batch.delete(doc.reference)
    batch.commit()

def _calc_raw_price_score(db, pid, p_data, routes, sam_pricing):
    if not routes: return 10.0
    our_pricing = p_data.get('defaultPricing', DEFAULT_PRICING)
    sum_r1 = sum_r2 = count = 0
    m1 = our_pricing.get('multipliers', DEFAULT_PRICING['multipliers'])
    m2 = sam_pricing.get('multipliers', DEFAULT_PRICING['multipliers'])
    for r in routes:
        dist = r.get('distance')
        if not dist or dist <= 0: continue
        o1 = _calc_ticket_price(dist, our_pricing.get('class1Per100km', 10), m1)
        o2 = _calc_ticket_price(dist, our_pricing.get('class2Per100km', 6), m1)
        s1 = _calc_ticket_price(dist, sam_pricing.get('class1Per100km', 10), m2)
        s2 = _calc_ticket_price(dist, sam_pricing.get('class2Per100km', 6), m2)
        if s1 > 0 and s2 > 0:
            sum_r1 += (o1 / s1); sum_r2 += (o2 / s2); count += 1
    if count == 0: return 10.0
    x = ((sum_r2 / count) * 0.8) + ((sum_r1 / count) * 0.2)
    score = -10 * math.log2(max(0.01, x)) + 10
    return max(0, min(20, score))

def _calc_raw_modernity_score(db, pid):
    active_ids = set()
    for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
        active_ids.update(ts_doc.to_dict().get('trainIds', []))
    if not active_ids: return 0.0
    now = datetime.now(timezone.utc)
    equiv_ages = []
    for tid in active_ids:
        t_doc = db.collection(f'players/{pid}/trains').document(tid).get()
        if not t_doc.exists: continue
        t = t_doc.to_dict()
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
    return max(0, min(20, 20 - (avg_age * 0.5)))

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
    return max(0, min(20, score)), round(perc, 1)

def update_price_reputation(db): update_reputation_metrics(db)
def update_modernity_reputation(db): update_reputation_metrics(db)
def update_fill_rate_reputation(db): update_reputation_metrics(db)
