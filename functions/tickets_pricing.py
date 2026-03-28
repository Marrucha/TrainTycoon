"""Cenniki, wyliczanie odległości i segmentów biletowych."""
import math

_DEFAULT_CLASS2_PER_100KM = 6

def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))

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
