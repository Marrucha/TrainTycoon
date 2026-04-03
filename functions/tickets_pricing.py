"""Cenniki, wyliczanie odległości i segmentów biletowych."""
import math

_DEFAULT_CLASS2_PER_100KM = 6

DEFAULT_PRICING = {
    'class1Per100km': 10,
    'class2Per100km': 6,
    'multipliers': [1.0, 0.9, 0.8, 0.7, 0.65, 0.6],
}

def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))

def _calc_ticket_price(dist_km, base_per_100km, multipliers):
    """Mirror of JS calcDistancePrice."""
    if not multipliers:
        multipliers = [1.0]
    cumulative = 0.0
    remaining = dist_km
    for mult in multipliers:
        segment = min(remaining, 100.0)
        cumulative += (segment / 100.0) * base_per_100km * mult
        remaining -= segment
        if remaining <= 0:
            break
    if remaining > 0:
        cumulative += (remaining / 100.0) * base_per_100km * (multipliers[-1] if multipliers else 1.0)
    return round(cumulative, 2)


def _ticket_price_for_pair(from_id, to_id, pricing, cities_map, cls):
    """Look up ticket price for a city pair and class (1 or 2)."""
    mo = pricing.get('matrixOverrides', {})
    key_ab = f'{from_id}--{to_id}'
    key_ba = f'{to_id}--{from_id}'
    ov_key = key_ab if key_ab in mo else (key_ba if key_ba in mo else None)
    if ov_key:
        ov = mo[ov_key].get('class1' if cls == 1 else 'class2')
        if ov is not None:
            return float(ov)

    city_a = cities_map.get(from_id) or cities_map.get(from_id.lower())
    city_b = cities_map.get(to_id) or cities_map.get(to_id.lower())
    if not city_a or not city_b:
        return 0.0

    dist = _haversine_km(city_a.get('lat', 0), city_a.get('lon', 0),
                         city_b.get('lat', 0), city_b.get('lon', 0))
    base = pricing.get('class1Per100km', 10) if cls == 1 else pricing.get('class2Per100km', 6)
    mults = pricing.get('multipliers', [1.0, 0.9, 0.8, 0.7, 0.65, 0.6])
    return _calc_ticket_price(dist, base, mults)


def _calc_min_segment_price(stops, cities, per_100km=_DEFAULT_CLASS2_PER_100KM):
    """Minimum class-2 ticket price over all consecutive stop pairs."""
    min_price = None
    for i in range(len(stops) - 1):
        c1 = cities.get(stops[i]['city_id'], {})
        c2 = cities.get(stops[i + 1]['city_id'], {})
        lat1, lon1 = c1.get('lat'), c1.get('lon')
        lat2, lon2 = c2.get('lat'), c2.get('lon')
        if lat1 is None or lat2 is None:
            continue
        dist = _haversine_km(lat1, lon1, lat2, lon2)
        price = max(1, round(dist * per_100km / 100))
        min_price = price if min_price is None else min(min_price, price)
    return min_price or 1
