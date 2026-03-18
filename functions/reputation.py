import math
from datetime import datetime, timezone
from reports import _calc_ticket_price, DEFAULT_PRICING

def update_reputation_metrics(db):
    """Entry point to update all reputation components for all players."""
    update_price_reputation(db)
    update_modernity_reputation(db)

def _update_total_reputation(ref, details):
    """Helper to sync total reputation out of 100."""
    # Ensure all components exist
    for key in ['punctualityScore', 'stabilityScore', 'modernityScore', 'priceScore', 'fillRateScore']:
        if key not in details:
            details[key] = 10.0 # Neutral starting value (50%)
            
    total_pts = sum([
        details['punctualityScore'],
        details['stabilityScore'],
        details['modernityScore'],
        details['priceScore'],
        details['fillRateScore']
    ])
    
    ref.update({
        'reputationDetails': details,
        'reputation': round(total_pts / 100, 4)
    })

def update_modernity_reputation(db):
    """Calculates fleet modernity score based on 'EquivAge = ActualAge / Efficiency'.
    
    Efficiency decays over time since lastMaintenance.
    Modernity Score: 0 years = 20 pts, 40 years = 0 pts.
    """
    now = datetime.now(timezone.utc)
    players = db.collection('players').stream()
    
    for p_doc in players:
        pid = p_doc.id
        if pid == 'samorządowy': continue
        
        p_data = p_doc.to_dict() or {}
        details = p_data.get('reputationDetails', {})
        
        # 1. Collect all train IDs in active trainSets
        active_train_ids = set()
        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            ts = ts_doc.to_dict() or {}
            ids = ts.get('trainIds') or []
            active_train_ids.update(ids)
            
        if not active_train_ids:
            details['modernityScore'] = 0.0
            _update_total_reputation(p_doc.reference, details)
            continue
            
        # 2. Fetch train details and calc EquivAge
        equiv_ages = []
        for tid in active_train_ids:
            t_doc = db.collection(f'players/{pid}/trains').document(tid).get()
            if not t_doc.exists: continue
            
            t = t_doc.to_dict()
            
            # Simple birth date from purchasedAt
            p_at = t.get('purchasedAt')
            if not p_at: p_at = now.isoformat()
            dt_p = datetime.fromisoformat(p_at.replace('Z', '+00:00'))
            actual_age_yrs = max(0, (now - dt_p).total_seconds() / (365.25 * 24 * 3600))
            
            # Efficiency based on lastMaintenance
            # Loses 50% efficiency per year without maintenance.
            lm_at = t.get('lastMaintenance')
            if not lm_at: lm_at = p_at
            dt_m = datetime.fromisoformat(lm_at.replace('Z', '+00:00'))
            days_since_m = max(0, (now - dt_m).total_seconds() / (24 * 3600))
            
            efficiency = max(0.1, 1.0 - (days_since_m / 365.25) * 0.5)
            
            equiv_ages.append(actual_age_yrs / efficiency)
            
        if not equiv_ages:
            details['modernityScore'] = 0.0
        else:
            avg_age = sum(equiv_ages) / len(equiv_ages)
            # 0 years = 20, 40 years = 0
            score = 20 - (avg_age * 0.5)
            details['modernityScore'] = round(max(0, min(20, score)), 2)
            
        _update_total_reputation(p_doc.reference, details)

def update_price_reputation(db):
    """Daily check of price competitiveness vs 'samorządowy' operator."""
    routes_col = db.collection('routes').stream()
    routes = [r.to_dict() for r in routes_col]
    if not routes: return

    sam_snap = db.collection('players').document('samorządowy').get()
    sam_pricing = (sam_snap.to_dict() or {}).get('defaultPricing', DEFAULT_PRICING)
    
    players = db.collection('players').stream()
    for p_doc in players:
        pid = p_doc.id
        if pid == 'samorządowy': continue
            
        p_data = p_doc.to_dict() or {}
        our_pricing = p_data.get('defaultPricing', DEFAULT_PRICING)
        details = p_data.get('reputationDetails', {})
        
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
        
        if count > 0:
            avg1 = sum_r1 / count; avg2 = sum_r2 / count
            x = (avg2 * 0.8) + (avg1 * 0.2)
            score = -10 * math.log2(max(0.01, x)) + 10
            details['priceScore'] = round(max(0, min(20, score)), 2)
            _update_total_reputation(p_doc.reference, details)
    return True
