def _find_city(cities, name_or_id):
    if not name_or_id:
        return None, None
    if name_or_id in cities:
        return cities[name_or_id], name_or_id
    found_id = next((cid for cid, c in cities.items() if c.get('name') == name_or_id), None)
    if found_id:
        return cities[found_id], found_id
    return None, None
