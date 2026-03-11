def _find_city(cities, name_or_id):
    if not name_or_id:
        return None, None
    if name_or_id in cities:
        return cities[name_or_id], name_or_id
    found = next((c for c in cities.values() if c.get('name') == name_or_id), None)
    if found:
        return found, found.get('id', name_or_id)
    return None, None
