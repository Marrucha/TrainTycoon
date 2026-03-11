import math

K = 5
DIST_EXP = 1.3

EU_COUNTRIES = {
    'Polska', 'Niemcy', 'Czechy', 'Słowacja', 'Austria', 'Węgry',
    'Francja', 'Belgia', 'Holandia', 'Luksemburg', 'Dania', 'Szwecja',
    'Finlandia', 'Estonia', 'Łotwa', 'Litwa', 'Rumunia', 'Bułgaria',
    'Chorwacja', 'Słowenia', 'Włochy', 'Hiszpania', 'Portugalia',
    'Grecja', 'Cypr', 'Malta', 'Irlandia',
}

# Hourly demand distribution (commute profile)
_HDM_RAW = [
    0.008, 0.004, 0.003, 0.003, 0.007, 0.018,
    0.045, 0.082, 0.078, 0.055, 0.042, 0.045,
    0.052, 0.050, 0.048, 0.050, 0.058, 0.075,
    0.082, 0.062, 0.048, 0.032, 0.018, 0.010,
]
_hdm_total = sum(_HDM_RAW)
HOUR_DEMAND_MAP = [v / _hdm_total for v in _HDM_RAW]

# Fallback values used when gameConfig/params is missing from Firestore
DEFAULT_CONFIG = {
    'priceDropRate': 0.1,
    'elasticity':    -3.0,
    'betaTime':      0.8,
    'betaRep':       1.0,
    'eBase':         8.0,
    'publicSpeed':   80,
    'publicPrice100': 50,
    'publicRep':     0.3,
}


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def hinterland(pop):
    return (pop ** (2 / 3)) * 27


def effective_pop(pop):
    return pop + hinterland(pop)


def get_demand(city_a, city_b):
    """Gravity model — replica of demand_sim.html: computeGravity().

    effPop = pop + hinterland(pop)
    base   = K × (effA/1000) × (effB/1000) / dist^1.3

    Multipliers (same country):
      capital city     × 1.2 each, independently
      same voivodeship + tier-1 non-capital × 1.1 each
      diff voivodeship × 0.9

    Multipliers (different country):
      both EU          × 0.3
      non-EU pair      × 0.15
    """
    pop_a = effective_pop(city_a.get('population', 100_000))
    pop_b = effective_pop(city_b.get('population', 100_000))
    dist = haversine(city_a['lat'], city_a['lon'], city_b['lat'], city_b['lon'])
    if dist < 1:
        return 0

    base = K * (pop_a / 1000) * (pop_b / 1000) / (dist ** DIST_EXP)

    country_a = city_a.get('country', 'Polska') or 'Polska'
    country_b = city_b.get('country', 'Polska') or 'Polska'

    if country_a != country_b:
        both_eu = country_a in EU_COUNTRIES and country_b in EU_COUNTRIES
        base *= 0.3 if both_eu else 0.15
    else:
        if city_a.get('isCapital'):
            base *= 1.2
        if city_b.get('isCapital'):
            base *= 1.2
        voiv_a = city_a.get('voivodeship')
        voiv_b = city_b.get('voivodeship')
        if voiv_a and voiv_b:
            if voiv_a == voiv_b:
                if city_a.get('tier') == 1 and not city_a.get('isCapital'):
                    base *= 1.1
                if city_b.get('tier') == 1 and not city_b.get('isCapital'):
                    base *= 1.1
            else:
                base *= 0.9

    return base


def calc_price(dist_km, p100, drop_rate=0.1):
    """Geometric degressive pricing.

    Each 100 km segment is priced at p100 × (1 − drop_rate)^segment_index.
    Matches demand_sim.html: calcPrice() with priceDropRate slider.
    """
    total = 0.0
    rem = dist_km
    seg = 0
    while rem > 0:
        chunk = min(rem, 100)
        total += (chunk / 100) * p100 * ((1.0 - drop_rate) ** seg)
        rem -= chunk
        seg += 1
    return total


def get_beta_price(elasticity, price_ref):
    """Calibrate β_price from own-price elasticity at share=0.5.

    At the reference point (share=0.5):  ε = β_price × P × 0.5
    → β_price = 2|ε| / P
    """
    return (2.0 * abs(elasticity) / price_ref) if price_ref > 0 else 0.04


def utility(price, time_min, reputation, has_restaurant,
            beta_price, beta_time, beta_rep):
    """Logit utility for a player train alternative."""
    return (
        -beta_price * price
        - beta_time * (time_min / 60)
        + beta_rep * reputation
        + 0.2 * (1 if has_restaurant else 0)
    )


def mode_split(u_player, u_public):
    """Binary logit: probability that passenger chooses player's train."""
    e_p = math.exp(min(u_player, 500))
    e_0 = math.exp(min(u_public, 500))
    return e_p / (e_p + e_0)


def class_split(price_c1, price_c2, pop_max, e_base=8.0):
    """Fraction of demand choosing class 1.

    E = e_base × 0.98^floor(pop_max / 100_000)
    class1_frac = 1 / (1 + E^max(0, r−1))  where r = price_c1 / price_c2
    """
    multiples = int(pop_max / 100_000)
    E = e_base * (0.98 ** multiples)
    r = (price_c1 / price_c2) if price_c2 > 0 else 1.0
    return 1.0 / (1.0 + E ** max(0.0, r - 1.0))


def _circ_dist(h1, h2):
    d = abs(h1 - h2)
    return min(d, 24 - d)


def _proximity_weight(d):
    return {0: 1.0, 1: 0.75, 2: 0.50, 3: 0.25}.get(d, 0.0)


def voronoi_alloc(hour, kurs_hours):
    """Fraction of demand at `hour` allocated to each kurs (binary split).

    kurs_hours: list of (kurs_id, dep_hour)
    Returns {kurs_id: fraction} — only winning kursy.
    """
    if not kurs_hours:
        return {}
    dists = [(kid, _circ_dist(hour, h)) for kid, h in kurs_hours]
    min_dist = min(d for _, d in dists)
    if min_dist > 3:
        return {}
    winners = [kid for kid, d in dists if d == min_dist]
    share = _proximity_weight(min_dist) / len(winners)
    return {kid: share for kid in winners}


def compute_flex_weights(kurs_hours):
    """Daily demand fraction per kurs via Voronoi allocation."""
    weights = {kid: 0.0 for kid, _ in kurs_hours}
    for h in range(24):
        alloc = voronoi_alloc(h, kurs_hours)
        for kid, frac in alloc.items():
            weights[kid] += HOUR_DEMAND_MAP[h] * frac
    return weights
