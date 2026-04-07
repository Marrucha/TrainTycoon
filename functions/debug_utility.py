"""
debug_utility.py — porównuje utility 2 pociągów na wspólnej trasie O-D w danej godzinie.

Użycie:
  python debug_utility.py <player_id> <ts_id_1> <kurs_1> <ts_id_2> <kurs_2> <hour>

Przykład:
  python debug_utility.py player1 trainset-pomorzanin 0 trainset-moniuszko 2 13
"""

import sys
import math
import firebase_admin
from firebase_admin import credentials, firestore

from demand_model import (
    DEFAULT_CONFIG, get_demand, calc_price, get_beta_price,
    utility, HOUR_DEMAND_MAP, _circ_dist, _proximity_weight, class_split,
)
from public_player import get_public_utility
from utils import _find_city

# ── Firebase init ────────────────────────────────────────────────────────────
import os
key_path = os.path.join(os.path.dirname(__file__), 'config', 'serviceAccountKey.json')
if os.path.exists(key_path):
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)
else:
    firebase_admin.initialize_app()

db = firestore.client()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_min(hhmm):
    if not hhmm:
        return -1
    parts = str(hhmm).split(':')
    if len(parts) != 2:
        return -1
    return int(parts[0]) * 60 + int(parts[1])


def _segment_time_min(stops, i, j):
    dep = _parse_min(stops[i].get('odjazd'))
    arr_key = 'przyjazd' if 'przyjazd' in stops[j] else 'odjazd'
    arr = _parse_min(stops[j].get(arr_key))
    diff = arr - dep
    return diff if diff > 0 else diff + 1440


def _collect_segments(ts, kurs_id, cities, base_trains, player_trains, cfg):
    """Zwraca listę segmentów OD (dict) dla danego kursu."""
    rozklad = ts.get('rozklad') or []
    by_kurs = {}
    for stop in rozklad:
        k = stop.get('kurs')
        if k is not None:
            by_kurs.setdefault(str(k), []).append(stop)

    stops = by_kurs.get(str(kurs_id))
    if not stops:
        print(f"  [BŁĄD] Nie znaleziono kursu '{kurs_id}'. Dostępne kursy: {list(by_kurs.keys())}")
        return []

    has_restaurant = any(
        'restaurant' in (player_trains.get(tid, {}).get('type', '') or '').lower()
        or 'bar' in (player_trains.get(tid, {}).get('type', '') or '').lower()
        for tid in (ts.get('trainIds') or [])
    )
    pricing   = ts.get('pricing') or {}
    p2_per100 = pricing.get('class2Per100km', 6)
    p1_per100 = pricing.get('class1Per100km', 10)
    drop_rate = cfg['priceDropRate']

    segs = []
    for i in range(len(stops) - 1):
        dep_str  = stops[i].get('odjazd', '00:00') or '00:00'
        dep_hour = int(dep_str.split(':')[0])
        for j in range(i + 1, len(stops)):
            city_a, id_a = _find_city(cities, stops[i].get('miasto'))
            city_b, id_b = _find_city(cities, stops[j].get('miasto'))
            if not city_a or not city_b:
                continue
            dist_km  = math.sqrt(
                (city_a['lat'] - city_b['lat'])**2 + (city_a['lon'] - city_b['lon'])**2
            ) * 111  # przybliżenie, demand_model używa haversine
            from demand_model import haversine
            dist_km  = haversine(city_a['lat'], city_a['lon'], city_b['lat'], city_b['lon'])
            time_min = _segment_time_min(stops, i, j)
            price2   = calc_price(dist_km, p2_per100, drop_rate)
            price1   = calc_price(dist_km, p1_per100, drop_rate)
            segs.append({
                'od':             f"{id_a}:{id_b}",
                'from':           city_a.get('name', id_a),
                'to':             city_b.get('name', id_b),
                'dep_hour':       dep_hour,
                'dep_time':       dep_str,
                'arr_time':       stops[j].get('przyjazd') or stops[j].get('odjazd', '?'),
                'dist_km':        round(dist_km, 1),
                'time_min':       time_min,
                'price2':         round(price2, 2),
                'price1':         round(price1, 2),
                'has_restaurant': has_restaurant,
                'p2_per100':      p2_per100,
                'p1_per100':      p1_per100,
            })
    return segs


def _load_train(pid, ts_id, cities, cfg):
    base_trains = {d.id: d.to_dict() for d in db.collection('trains').stream()}
    player_trains = {}
    for d in db.collection(f'players/{pid}/trains').stream():
        data = d.to_dict()
        base = base_trains.get(data.get('parent_id'), {})
        player_trains[d.id] = {**base, **data}

    ts_doc = db.collection(f'players/{pid}/trainSet').document(ts_id).get()
    if not ts_doc.exists:
        print(f"[BŁĄD] Nie znaleziono trainSet '{ts_id}' dla gracza '{pid}'")
        sys.exit(1)
    ts = ts_doc.to_dict()
    p_doc = db.collection('players').document(pid).get()
    reputation = (p_doc.to_dict() or {}).get('reputation', 0.5) if p_doc.exists else 0.5
    return ts, player_trains, base_trains, reputation


# ── Main ─────────────────────────────────────────────────────────────────────

def _list_trainsets(pid):
    print(f"\nDostępne trainSety dla gracza '{pid}':")
    for doc in db.collection(f'players/{pid}/trainSet').stream():
        ts = doc.to_dict()
        kursy = list({s.get('kurs') for s in (ts.get('rozklad') or []) if s.get('kurs') is not None})
        print(f"  {doc.id:40s}  nazwa={ts.get('name','?'):20s}  kursy={sorted(kursy)}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == '--list':
        pid = sys.argv[2] if len(sys.argv) > 2 else 'player1'
        _list_trainsets(pid)
        sys.exit(0)

    if len(sys.argv) < 7:
        print(__doc__)
        sys.exit(1)

    pid    = sys.argv[1]
    ts_id1 = sys.argv[2]
    kurs1  = sys.argv[3]
    ts_id2 = sys.argv[4]
    kurs2  = sys.argv[5]
    hour   = int(sys.argv[6])

    cfg_snap = db.collection('gameConfig').document('params').get()
    cfg = {**DEFAULT_CONFIG, **(cfg_snap.to_dict() if cfg_snap.exists else {})}
    cities = {d.id: d.to_dict() for d in db.collection('cities').stream()}

    print(f"\n{'='*60}")
    print(f"  Analiza utility @ godzina {hour}:00")
    print(f"  Gracz: {pid}")
    print(f"{'='*60}\n")

    # Załaduj oba trainSety
    ts1, pt1, bt1, rep1 = _load_train(pid, ts_id1, cities, cfg)
    ts2, pt2, bt2, rep2 = _load_train(pid, ts_id2, cities, cfg)

    segs1 = _collect_segments(ts1, kurs1, cities, bt1, pt1, cfg)
    segs2 = _collect_segments(ts2, kurs2, cities, bt2, pt2, cfg)

    print(f"[1] {ts1.get('name', ts_id1)}  kurs={kurs1}  ({len(segs1)} segmentów)")
    print(f"[2] {ts2.get('name', ts_id2)}  kurs={kurs2}  ({len(segs2)} segmentów)\n")

    # Wspólne OD pary
    od1 = {s['od']: s for s in segs1}
    od2 = {s['od']: s for s in segs2}
    common = set(od1.keys()) & set(od2.keys())

    if not common:
        print("Brak wspólnych par O-D między tymi kursami.")
        print(f"\nSegmenty [1]: {[s['od'] for s in segs1]}")
        print(f"Segmenty [2]: {[s['od'] for s in segs2]}")
        sys.exit(0)

    print(f"Wspólne pary O-D: {sorted(common)}\n")

    for od_key in sorted(common):
        s1 = od1[od_key]
        s2 = od2[od_key]

        print(f"{'─'*60}")
        print(f"  Trasa: {s1['from']} → {s1['to']}  [{od_key}]")
        print(f"{'─'*60}")

        # Kalkulacja beta_price z avg obu cen
        avg_p2 = (s1['price2'] + s2['price2']) / 2
        beta_price = get_beta_price(cfg['elasticity'], avg_p2)

        city_a = next((c for cid, c in cities.items() if cid == od_key.split(':')[0]), {})
        city_b = next((c for cid, c in cities.items() if cid == od_key.split(':')[1]), {})
        gravity = get_demand(city_a, city_b) if city_a and city_b else 0
        pop_max = max(city_a.get('population', 100_000), city_b.get('population', 100_000))

        hour_demand = gravity * HOUR_DEMAND_MAP[hour]

        def seg_info(s, rep, label):
            u = utility(
                s['price2'], s['time_min'], rep, s['has_restaurant'],
                beta_price, cfg['betaTime'], cfg['betaRep'],
            )
            exp_u = math.exp(min(u, 500))
            circ  = _circ_dist(hour, s['dep_hour'])
            prox  = _proximity_weight(circ)
            print(f"  [{label}] {ts1['name'] if label=='1' else ts2['name']}")
            print(f"      dep: {s['dep_time']} (dep_hour={s['dep_hour']})  arr: {s['arr_time']}")
            print(f"      dist: {s['dist_km']} km  time: {s['time_min']} min")
            print(f"      cena kl.2: {s['price2']} zł  kl.1: {s['price1']} zł  (p2_per100={s['p2_per100']})")
            print(f"      restauracja: {s['has_restaurant']}")
            print(f"      utility U = {u:.4f}  exp(U) = {exp_u:.4f}")
            print(f"      Voronoi: dist_godzin={circ}  waga={prox}  wins_hour={circ==0 or prox>0}")
            return u, exp_u, circ, prox

        u1, exp_u1, circ1, prox1 = seg_info(s1, rep1, '1')
        print()
        u2, exp_u2, circ2, prox2 = seg_info(s2, rep2, '2')

        # Voronoi winners dla tej godziny
        segs_voronoi = [
            {'dep_hour': s1['dep_hour'], 'exp_u': exp_u1, 'label': '1'},
            {'dep_hour': s2['dep_hour'], 'exp_u': exp_u2, 'label': '2'},
        ]
        dists = [(s, _circ_dist(hour, s['dep_hour'])) for s in segs_voronoi]
        min_dist = min(d for _, d in dists)
        winners = [s for s, d in dists if d == min_dist]
        base_w = _proximity_weight(min_dist)

        print(f"\n  Gravity demand dla tej trasy: {gravity:.2f}  HOUR_MAP[{hour}]={HOUR_DEMAND_MAP[hour]:.4f}")
        print(f"  Demand w tej godzinie: {hour_demand:.2f}")
        print(f"  Voronoi min_dist={min_dist}  base_weight={base_w}")
        print(f"  Voronoi winners: {[w['label'] for w in winners]}")

        if not winners or base_w == 0:
            print(f"  → Żaden pociąg nie wygrywa Voronoi dla godziny {hour}.")
        else:
            exp_pub = math.exp(min(
                get_public_utility(s1['dist_km'], cfg, beta_price, cfg['betaTime'], cfg['betaRep']),
                500,
            ))
            accessible = hour_demand * base_w
            winner_labels = {w['label'] for w in winners}
            exp_sum = exp_pub + sum(w['exp_u'] for w in winners)

            pax1 = accessible * (exp_u1 / exp_sum) if '1' in winner_labels else 0
            pax2 = accessible * (exp_u2 / exp_sum) if '2' in winner_labels else 0

            c1_frac1 = class_split(s1['price1'], s1['price2'], pop_max, cfg['eBase'])
            c1_frac2 = class_split(s2['price1'], s2['price2'], pop_max, cfg['eBase'])

            print(f"\n  exp_pub (transport publ.) = {exp_pub:.4f}")
            print(f"  exp_sum = {exp_sum:.4f}")
            print(f"  accessible demand = {accessible:.2f}")
            print(f"\n  ┌──────────────────────────────────────────┐")
            print(f"  │  Pociąg 1: {pax1:6.2f} pax  ({pax1/accessible*100:.1f}%)  kl1={round(pax1*c1_frac1)} kl2={round(pax1*(1-c1_frac1))}  │")
            print(f"  │  Pociąg 2: {pax2:6.2f} pax  ({pax2/accessible*100:.1f}%)  kl1={round(pax2*c1_frac2)} kl2={round(pax2*(1-c1_frac2))}  │")
            print(f"  │  Transport pub.: {accessible*(exp_pub/exp_sum):6.2f} pax  ({accessible*(exp_pub/exp_sum)/accessible*100:.1f}%)              │")
            print(f"  └──────────────────────────────────────────┘")
        print()


if __name__ == '__main__':
    main()
