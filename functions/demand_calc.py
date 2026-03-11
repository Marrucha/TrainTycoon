from datetime import datetime, timezone
import math

from boarding_sim import rebuild_schedule_table
from demand_model import (
    DEFAULT_CONFIG, get_demand, calc_price, get_beta_price,
    haversine, utility, class_split,
    HOUR_DEMAND_MAP, _circ_dist, _proximity_weight,
)
from public_player import get_public_utility
from utils import _find_city


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _voronoi_multi(hour, segs):
    """Find nearest segs (by dep_hour) using circular distance.

    Returns (winner_segs, base_weight).
    Mirrors demand_sim.html voronoiAlloc: returns ALL tied winners + the
    proximity weight for that distance level (not divided by n — that is
    handled by the multinomial denominator).
    """
    if not segs:
        return [], 0.0
    dists = [(s, _circ_dist(hour, s['dep_hour'])) for s in segs]
    min_dist = min(d for _, d in dists)
    if min_dist > 3:
        return [], 0.0
    winners = [s for s, d in dists if d == min_dist]
    return winners, _proximity_weight(min_dist)



def _parse_time_min(hhmm):
    if not hhmm:
        return 0
    parts = str(hhmm).split(':')
    return int(parts[0]) * 60 + int(parts[1]) if len(parts) == 2 else 0


def _segment_time_min(stops, i, j):
    dep = _parse_time_min(stops[i].get('odjazd'))
    arr_key = 'przyjazd' if 'przyjazd' in stops[j] else 'odjazd'
    arr = _parse_time_min(stops[j].get(arr_key))
    diff = arr - dep
    return diff if diff > 0 else diff + 1440


# ---------------------------------------------------------------------------
# Main entry point (called from main.py)
# ---------------------------------------------------------------------------

def calc_demand_for_train_sets(db):
    """Calculate daily passenger demand for ALL players using multinomial logit.

    All players' kursy compete for the same O-D demand pool per time slot:
      1. Group every kurs from every player by directional O-D pair.
      2. Per route: calibrate beta_price from average price, compute exp(U).
      3. Per hour: Voronoi finds nearest kursy across ALL players,
         multinomial softmax distributes demand among them + public.
      4. Write dailyDemand back to each player's trainSet document.

    Consistent with demand_sim.html multinomial implementation.
    """
    # ----------------------------------------------------------------
    # 1. Load game config (saved via demand simulator → gameConfig/params)
    # ----------------------------------------------------------------
    cfg_snap = db.collection('gameConfig').document('params').get()
    cfg = {**DEFAULT_CONFIG, **(cfg_snap.to_dict() if cfg_snap.exists else {})}

    drop_rate  = cfg['priceDropRate']
    elasticity = cfg['elasticity']
    beta_time  = cfg['betaTime']
    beta_rep   = cfg['betaRep']
    e_base     = cfg['eBase']

    # ----------------------------------------------------------------
    # 2. Load reference data
    # ----------------------------------------------------------------
    cities      = {d.id: d.to_dict() for d in db.collection('cities').stream()}
    base_trains = {d.id: d.to_dict() for d in db.collection('trains').stream()}

    # ----------------------------------------------------------------
    # 3. Collect ALL players' kursy, grouped by directional O-D pair
    #
    # route_map["id_a:id_b"] = {
    #     id_a, id_b, gravity, pop_max,
    #     segs: [{
    #         key:            (player_id, ts_id, kurs_id),
    #         dep_hour:       int,
    #         dist_km:        float,
    #         time_min:       int,
    #         price2:         float,
    #         price1:         float,
    #         reputation:     float,
    #         has_restaurant: bool,
    #         # added in step 4:
    #         exp_u:          float,
    #     }]
    # }
    #
    # route_key is DIRECTIONAL: A→B and B→A are separate demand flows.
    # ----------------------------------------------------------------
    route_map = {}
    ts_refs   = {}   # (player_id, ts_id) → Firestore doc reference

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue   # public operator is a baseline, not a player

        p_data     = p_doc.to_dict() or {}
        reputation = p_data.get('reputation', 0.5)

        player_trains = {}
        for d in db.collection(f'players/{pid}/trains').stream():
            data = d.to_dict()
            base = base_trains.get(data.get('parent_id'), {})
            player_trains[d.id] = {**base, **data}

        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            ts      = ts_doc.to_dict()
            rozklad = ts.get('rozklad') or []
            if not rozklad:
                continue

            ts_refs[(pid, ts_doc.id)] = ts_doc.reference

            has_restaurant = any(
                'restaurant' in (player_trains.get(tid, {}).get('type', '') or '').lower()
                or 'bar' in (player_trains.get(tid, {}).get('type', '') or '').lower()
                for tid in (ts.get('trainIds') or [])
            )
            pricing   = ts.get('pricing') or {}
            p2_per100 = pricing.get('class2Per100km', 6)
            p1_per100 = pricing.get('class1Per100km', 10)

            # Group stops by kurs
            by_kurs = {}
            for stop in rozklad:
                k = stop.get('kurs')
                if k is not None:
                    by_kurs.setdefault(k, []).append(stop)

            for kurs_id, stops in by_kurs.items():
                if not stops:
                    continue
                dep_hour = int(
                    (stops[0].get('odjazd', '00:00') or '00:00').split(':')[0]
                )

                # Every ordered pair of stops is an O-D segment
                for i in range(len(stops) - 1):
                    for j in range(i + 1, len(stops)):
                        city_a, id_a = _find_city(cities, stops[i].get('miasto'))
                        city_b, id_b = _find_city(cities, stops[j].get('miasto'))
                        if not city_a or not city_b:
                            continue

                        dist_km  = haversine(city_a['lat'], city_a['lon'],
                                             city_b['lat'], city_b['lon'])
                        time_min = _segment_time_min(stops, i, j)
                        price2   = calc_price(dist_km, p2_per100, drop_rate)
                        price1   = calc_price(dist_km, p1_per100, drop_rate)

                        route_key = f"{id_a}:{id_b}"
                        if route_key not in route_map:
                            route_map[route_key] = {
                                'id_a':    id_a,
                                'id_b':    id_b,
                                'gravity': get_demand(city_a, city_b),
                                'pop_max': max(
                                    city_a.get('population', 100_000),
                                    city_b.get('population', 100_000),
                                ),
                                'segs': [],
                            }

                        route_map[route_key]['segs'].append({
                            'key':            (pid, ts_doc.id, kurs_id),
                            'dep_hour':       dep_hour,
                            'dist_km':        dist_km,
                            'time_min':       time_min,
                            'price2':         price2,
                            'price1':         price1,
                            'reputation':     reputation,
                            'has_restaurant': has_restaurant,
                        })

    # ----------------------------------------------------------------
    # 4. Per route: calibrate beta_price, compute utilities, run
    #    Voronoi + multinomial per hour
    #
    # beta_price is calibrated from the average class-2 price across ALL
    # competitors on the route (IIA: common scale parameter for the logit).
    # ----------------------------------------------------------------
    pax_accum = {}   # (player_id, ts_id, kurs_id) → {od_key: {c1, c2}}

    for route_key, rd in route_map.items():
        gravity = rd['gravity']
        segs    = rd['segs']
        pop_max = rd['pop_max']
        id_a    = rd['id_a']
        id_b    = rd['id_b']
        od_key  = f"{id_a}:{id_b}"

        if gravity <= 0 or not segs:
            continue

        # Calibrate beta_price from average competitor price on this route
        avg_price2 = sum(s['price2'] for s in segs) / len(segs)
        beta_price = get_beta_price(elasticity, avg_price2)

        # Pre-compute exp(U) for each competitor seg (constant across hours)
        for s in segs:
            u = utility(
                s['price2'], s['time_min'], s['reputation'], s['has_restaurant'],
                beta_price, beta_time, beta_rep,
            )
            s['exp_u'] = math.exp(min(u, 500))

        # Pre-compute public exp(U) for this route (constant across hours)
        sample_dist = segs[0]['dist_km']
        exp_pub = math.exp(min(
            get_public_utility(sample_dist, cfg, beta_price, beta_time, beta_rep),
            500,
        ))

        seg_pax = {s['key']: 0.0 for s in segs}

        # Multinomial demand per hour
        for h in range(24):
            hour_demand       = gravity * HOUR_DEMAND_MAP[h]
            winners, base_w   = _voronoi_multi(h, segs)
            if not winners or base_w == 0:
                continue

            accessible = hour_demand * base_w
            exp_sum    = exp_pub + sum(w['exp_u'] for w in winners)

            for w in winners:
                seg_pax[w['key']] += accessible * (w['exp_u'] / exp_sum)

        # Class split → integer passengers per competitor seg
        for s in segs:
            total_pax = seg_pax[s['key']]
            c1_frac   = class_split(s['price1'], s['price2'], pop_max, e_base)
            pax1      = round(total_pax * c1_frac)
            pax2      = round(total_pax * (1.0 - c1_frac))

            k = s['key']
            if k not in pax_accum:
                pax_accum[k] = {}
            pax_accum[k][od_key] = {'class1': pax1, 'class2': pax2}

    # ----------------------------------------------------------------
    # 5. Aggregate per trainSet and write to Firestore
    # ----------------------------------------------------------------
    ts_daily = {}   # (player_id, ts_id) → {str(kurs_id): demand_entry}

    for (pid, ts_id, kurs_id), od_map in pax_accum.items():
        total_c1 = sum(v['class1'] for v in od_map.values())
        total_c2 = sum(v['class2'] for v in od_map.values())
        ts_key   = (pid, ts_id)
        if ts_key not in ts_daily:
            ts_daily[ts_key] = {}
        ts_daily[ts_key][str(kurs_id)] = {
            'total':     total_c1 + total_c2,
            'class1':    total_c1,
            'class2':    total_c2,
            'od':        od_map,
            'updatedAt': datetime.now(timezone.utc).isoformat(),
        }

    batch   = db.batch()
    updated = 0

    for (pid, ts_id), daily_demand in ts_daily.items():
        ref = ts_refs.get((pid, ts_id))
        if ref:
            batch.update(ref, {
                'dailyDemand':     daily_demand,
                'dailyTransfer':   {},   # reset at start of each day
                'currentTransfer': {},   # trains are not yet moving
            })
            updated += 1

    batch.commit()
    print(f'Demand calculation complete (multinomial, all players). '
          f'Updated {updated} trainSet(s).')

    # Rebuild flat schedule table used by the boarding tick
    rebuild_schedule_table(db)

    return updated
