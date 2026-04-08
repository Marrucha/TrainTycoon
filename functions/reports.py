"""Daily report generator.

Saves aggregated per-kurs statistics to players/{pid}/Raporty/{date}
BEFORE the daily reset. Called from calc_daily_demand at 02:59 (before reset).

Document structure in Raporty:
  date:       str               "YYYY-MM-DD"  (the day being reported)
  timestamp:  str               ISO timestamp of report generation
  trainSets:  dict[ts_id -> {
    name:     str
    kursy:    dict[kurs_id -> {
      odjazd:       str           "HH:MM"
      from:         str           city name
      to:           str           city name
      transferred:  {class1, class2, total}    (completed trips only)
      demand:       {class1, class2, total}    (remaining demand not served)
      totalDemand:  {class1, class2, total}    (transferred + demand; onBoard counted next day)
      realizacja:   float          0..1        (transferred / totalDemand)
      realizacjaC1: float
      realizacjaC2: float
      przychod:     int            PLN
      km:           int            km przejechane przez ten kurs
      koszt:        int            PLN (km * costPerKm)
      netto:        int            PLN (przychod - koszt)
    }]
    daily: {
      transferred: {class1, class2, total}
      demand:      {class1, class2, total}
      totalDemand: {class1, class2, total}
      realizacja:  float
      przychod:    int
      km:          int
      koszt:       int
      netto:       int
    }
  }]
"""

import math
from datetime import datetime, timezone, timedelta

from staff import _write_daily_ledger


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def _time_to_min(t):
    """'HH:MM' → minutes from midnight."""
    h, m = map(int, t.split(':'))
    return h * 60 + m

def _time_diff_min(t_from, t_to):
    """t_to - t_from in minutes, handles midnight crossing (max 24h span)."""
    d = _time_to_min(t_to) - _time_to_min(t_from)
    if d < 0:
        d += 24 * 60
    return d

# ---------------------------------------------------------------------------
# Pricing
# ---------------------------------------------------------------------------

def _calc_ticket_price(dist_km, base_per_100km, multipliers):
    """Mirror of JS calcDistancePrice."""
    if not multipliers:
        multipliers = [1.0]
    cumulative = 0.0
    remaining = dist_km
    for i, mult in enumerate(multipliers):
        segment = min(remaining, 100.0)
        cumulative += (segment / 100.0) * base_per_100km * mult
        remaining -= segment
        if remaining <= 0:
            break
    if remaining > 0:
        # beyond last bracket — use last multiplier
        cumulative += (remaining / 100.0) * base_per_100km * (multipliers[-1] if multipliers else 1.0)
    return round(cumulative, 2)


def _ticket_price_for_pair(from_id, to_id, pricing, cities_map, cls):
    """Look up ticket price for a city pair and class (1 or 2)."""
    # 1. Matrix override
    mo = pricing.get('matrixOverrides', {})
    key_ab = f'{from_id}--{to_id}'
    key_ba = f'{to_id}--{from_id}'
    ov_key = key_ab if key_ab in mo else (key_ba if key_ba in mo else None)
    if ov_key:
        ov = mo[ov_key].get('class1' if cls == 1 else 'class2')
        if ov is not None:
            return float(ov)

    # 2. Distance-based
    city_a = cities_map.get(from_id) or cities_map.get(from_id.lower())
    city_b = cities_map.get(to_id) or cities_map.get(to_id.lower())
    if not city_a or not city_b:
        return 0.0

    lat_a, lon_a = city_a.get('lat', 0), city_a.get('lon', 0)
    lat_b, lon_b = city_b.get('lat', 0), city_b.get('lon', 0)
    dist = _haversine_km(lat_a, lon_a, lat_b, lon_b)

    base = pricing.get('class1Per100km', 10) if cls == 1 else pricing.get('class2Per100km', 6)
    mults = pricing.get('multipliers', [1.0, 0.9, 0.8, 0.7, 0.65, 0.6])
    return _ticket_price_for_pair_dist(dist, base, mults)


def _ticket_price_for_pair_dist(dist_km, base_per_100km, multipliers):
    return _calc_ticket_price(dist_km, base_per_100km, multipliers)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

ENERGY_PRICE_KWH = 0.80  # PLN za kWh

DEFAULT_PRICING = {
    'class1Per100km': 10,
    'class2Per100km': 6,
    'multipliers': [1.0, 0.9, 0.8, 0.7, 0.65, 0.6],
}


def save_daily_report(db, date_str=None, ts_str=None):
    """Snapshot dailyDemand / dailyTransfer / currentTransfer for all
    trainSets and write aggregated kurs-level stats to
    players/{pid}/Raporty/{date}.

    date_str: game date in 'YYYY-MM-DD' format. If None, falls back to
              Warsaw real-world time (legacy behaviour).
    """
    if date_str is None:
        import zoneinfo
        now_waw = datetime.now(zoneinfo.ZoneInfo('Europe/Warsaw'))
        date_str = now_waw.strftime('%Y-%m-%d')
        ts_str   = now_waw.isoformat()
    elif ts_str is None:
        ts_str = datetime.now(timezone.utc).isoformat()

    cities_col = db.collection('cities').stream()
    cities_map = {}
    for c in cities_col:
        d = c.to_dict()
        cities_map[c.id] = d
        # also index by name for fallback
        if d.get('name'):
            cities_map[d['name']] = d

    trains_map = {d.id: d.to_dict() for d in db.collection('trains').stream()}

    player_default_pricing = {}  # pid -> defaultPricing

    batch = db.batch()
    written = 0

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        p_data = p_doc.to_dict() or {}
        default_pricing = p_data.get('defaultPricing', DEFAULT_PRICING)
        player_default_pricing[pid] = default_pricing

        ts_agg = {}  # ts_id -> report dict

        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            ts_id   = ts_doc.id
            ts      = ts_doc.to_dict() or {}
            pricing = ts.get('pricing') or default_pricing

            daily_demand    = ts.get('dailyDemand') or {}
            daily_transfer  = ts.get('dailyTransfer') or {}
            current_tf      = ts.get('currentTransfer') or {}
            daily_arrivals  = ts.get('dailyArrivals') or {}
            rozklad         = ts.get('rozklad') or []

            # Build name lookup: kurs_id -> first-stop info
            by_kurs = {}
            for stop in rozklad:
                k = str(stop.get('kurs', ''))
                if k not in by_kurs:
                    by_kurs[k] = []
                by_kurs[k].append(stop)

            # Daily km calculation
            daily_km = 0
            for k_stops in by_kurs.values():
                for i in range(len(k_stops) - 1):
                    ca = cities_map.get(k_stops[i].get('miasto', ''))
                    cb = cities_map.get(k_stops[i + 1].get('miasto', ''))
                    if ca and cb:
                        daily_km += _haversine_km(
                            ca.get('lat', 0), ca.get('lon', 0),
                            cb.get('lat', 0), cb.get('lon', 0),
                        )
            daily_km = round(daily_km)

            # Właściwości energetyczne składu (niezależne od kursu)
            train_ids_pre = ts.get('trainIds') or []
            wagon_count_pre = sum(1 for tid in train_ids_pre if (trains_map.get(tid) or {}).get('seats', 0) > 0)
            speeds_pre = [trains_map[tid]['speed'] for tid in train_ids_pre if trains_map.get(tid) and trains_map[tid].get('speed')]
            max_speed_pre = max(speeds_pre) if speeds_pre else 100
            extra_wagons_pre = max(0, wagon_count_pre - 1)
            energy_per_100km = (1000 + 100 * extra_wagons_pre) * (1.1 ** ((max_speed_pre - 100) / 10))

            # Per-kurs aggregation
            all_kurs_ids = set(list(daily_demand.keys()) + list(daily_transfer.keys()) + list(current_tf.keys()))
            kursy_report = {}

            day_ob_c1 = day_ob_c2 = 0
            day_tr_c1 = day_tr_c2 = 0
            day_dm_c1 = day_dm_c2 = 0
            day_rev = day_rev_c1 = day_rev_c2 = 0
            day_wars = day_fines = 0
            day_energy = 0

            for kurs_id in all_kurs_ids:
                kd = daily_demand.get(kurs_id, {})
                kt = daily_transfer.get(kurs_id, {})
                kc = current_tf.get(kurs_id, {})

                kurs_wars  = int(kt.get('warsRevenue',    0))
                kurs_fines = int(kt.get('fineRevenue',    0))
                kurs_insp  = float(kt.get('inspectionIndex', 0.0))

                od_demand   = kd.get('od', {})
                od_transfer = kt.get('od', {})
                on_board    = kc.get('onBoard', {})

                # Only transferred counts for realizacja — onBoard will appear next day
                tr_c1 = kt.get('class1', 0)
                tr_c2 = kt.get('class2', 0)
                dm_c1 = kd.get('class1', 0)
                dm_c2 = kd.get('class2', 0)

                orig_c1 = tr_c1 + dm_c1
                orig_c2 = tr_c2 + dm_c2
                orig    = orig_c1 + orig_c2

                real     = round(tr_c1 + tr_c2) / orig     if orig > 0 else 0.0
                real_c1  = round(tr_c1 / orig_c1, 4)       if orig_c1 > 0 else 0.0
                real_c2  = round(tr_c2 / orig_c2, 4)       if orig_c2 > 0 else 0.0

                # Revenue — calculated at boarding time in boarding_sim; fall back to
                # on-the-fly calculation for legacy data that predates that field.
                if kt.get('revenue') is not None:
                    revenue    = round(kt['revenue'])
                    revenue_c1 = round(kt.get('revenueC1', 0))
                    revenue_c2 = round(kt.get('revenueC2', 0))
                else:
                    revenue = revenue_c1 = revenue_c2 = 0
                    for od_key in set(list(od_transfer.keys()) + list(on_board.keys())):
                        parts = od_key.split(':')
                        if len(parts) != 2:
                            continue
                        from_id, to_id = parts
                        val_tr = od_transfer.get(od_key, {})
                        p1 = _ticket_price_for_pair(from_id, to_id, pricing, cities_map, 1)
                        p2 = _ticket_price_for_pair(from_id, to_id, pricing, cities_map, 2)
                        revenue_c1 += val_tr.get('class1', 0) * p1
                        revenue_c2 += val_tr.get('class2', 0) * p2
                    revenue    = round(revenue_c1 + revenue_c2)
                    revenue_c1 = round(revenue_c1)
                    revenue_c2 = round(revenue_c2)

                # First/last stop info for this kurs
                k_stops   = by_kurs.get(kurs_id, [])
                odjazd    = k_stops[0].get('odjazd', '')   if k_stops else ''
                from_c    = k_stops[0].get('miasto', '')   if k_stops else ''
                to_c      = k_stops[-1].get('kierunek', k_stops[-1].get('miasto', '')) if k_stops else ''
                from_name = cities_map.get(from_c, {}).get('name', from_c)
                to_name   = cities_map.get(to_c,   {}).get('name', to_c)

                # Scheduled arrival = last stop przyjazd (or odjazd for terminal)
                last_stop = k_stops[-1] if k_stops else {}
                scheduled_arrival = last_stop.get('przyjazd') or last_stop.get('odjazd') or None
                actual_arrival    = daily_arrivals.get(kurs_id)

                delay_min = None
                if scheduled_arrival and actual_arrival:
                    delay_min = _time_diff_min(scheduled_arrival, actual_arrival)
                    if delay_min > 12 * 60:   # >12h difference = arrived early (negative delay)
                        delay_min -= 24 * 60

                # Per-kurs km
                kurs_km = 0
                for i in range(len(k_stops) - 1):
                    ca = cities_map.get(k_stops[i].get('miasto', ''))
                    cb = cities_map.get(k_stops[i + 1].get('miasto', ''))
                    if ca and cb:
                        kurs_km += _haversine_km(
                            ca.get('lat', 0), ca.get('lon', 0),
                            cb.get('lat', 0), cb.get('lon', 0),
                        )
                kurs_km = round(kurs_km)
                cost_per_km = ts.get('totalCostPerKm', 0) or 0
                kurs_koszt = round(cost_per_km * kurs_km)

                # Energia: km + 300 kWh za każdy przystanek poza ostatnim
                stop_count = max(0, len(k_stops) - 1)  # start + pośrednie, bez końcowego
                kurs_energy_kwh = (kurs_km / 100) * energy_per_100km + stop_count * 300
                kurs_energy_cost = round(kurs_energy_kwh * ENERGY_PRICE_KWH)

                kurs_netto = revenue - kurs_koszt - kurs_energy_cost

                # Commercial speed: km / actual travel time
                commercial_speed = None
                if actual_arrival and odjazd and kurs_km > 0:
                    travel_min = _time_diff_min(odjazd, actual_arrival)
                    if travel_min > 0:
                        commercial_speed = kurs_km / (travel_min / 60)

                kursy_report[kurs_id] = {
                    'odjazd': odjazd,
                    'from':   from_name,
                    'to':     to_name,
                    'transferred': {'class1': tr_c1, 'class2': tr_c2, 'total': tr_c1 + tr_c2},
                    'demand':      {'class1': dm_c1, 'class2': dm_c2, 'total': dm_c1 + dm_c2},
                    'totalDemand': {'class1': orig_c1, 'class2': orig_c2, 'total': orig},
                    'realizacja':   round(real, 4),
                    'realizacjaC1': real_c1,
                    'realizacjaC2': real_c2,
                    'przychod':   revenue,
                    'przychodC1': revenue_c1,
                    'przychodC2': revenue_c2,
                    'warsRevenue':     kurs_wars,
                    'fineRevenue':     kurs_fines,
                    'inspectionIndex': round(kurs_insp, 4),
                    'km':         kurs_km,
                    'koszt':      kurs_koszt,
                    'energyCost': kurs_energy_cost,
                    'netto':      kurs_netto,
                    'scheduledArrival':  scheduled_arrival,
                    'actualArrival':     actual_arrival,
                    'delayMin':          delay_min,
                    'commercialSpeedKmh': commercial_speed,
                }

                day_tr_c1 += tr_c1; day_tr_c2 += tr_c2
                day_dm_c1 += dm_c1; day_dm_c2 += dm_c2
                day_rev += revenue
                day_rev_c1 += revenue_c1
                day_rev_c2 += revenue_c2
                day_wars   += kurs_wars
                day_fines  += kurs_fines
                day_energy += kurs_energy_cost

            day_orig_c1 = day_tr_c1 + day_dm_c1
            day_orig_c2 = day_tr_c2 + day_dm_c2
            day_orig    = day_orig_c1 + day_orig_c2

            cost_per_km = ts.get('totalCostPerKm', 0) or 0
            daily_cost  = round(cost_per_km * daily_km)
            netto        = round(day_rev) - daily_cost - day_energy

            # Fleet composition
            train_ids   = train_ids_pre
            wagon_count = wagon_count_pre
            loco_count  = sum(1 for tid in train_ids if (trains_map.get(tid) or {}).get('seats', 0) == 0)
            energy_cost = day_energy

            ts_agg[ts_id] = {
                'name':   ts.get('name', ts_id),
                'kursy':  kursy_report,
                'daily': {
                    'transferred': {'class1': day_tr_c1, 'class2': day_tr_c2, 'total': day_tr_c1 + day_tr_c2},
                    'demand':      {'class1': day_dm_c1, 'class2': day_dm_c2, 'total': day_dm_c1 + day_dm_c2},
                    'totalDemand': {'class1': day_orig_c1, 'class2': day_orig_c2, 'total': day_orig},
                    'realizacja':  round((day_tr_c1 + day_tr_c2) / day_orig, 4) if day_orig > 0 else 0.0,
                    'przychod':    round(day_rev),
                    'przychodC1':  round(day_rev_c1),
                    'przychodC2':  round(day_rev_c2),
                    'warsRevenue': day_wars,
                    'fineRevenue': day_fines,
                    'km':          daily_km,
                    'koszt':       daily_cost,
                    'energyCost':  energy_cost,
                    'netto':       netto,
                    'wagonCount':  wagon_count,
                    'locoCount':   loco_count,
                },
            }

        if ts_agg:
            ref = db.collection(f'players/{pid}/Raporty').document(date_str)
            batch.set(ref, {
                'date':      date_str,
                'timestamp': ts_str,
                'trainSets': ts_agg,
            })
            written += 1

            # --- Financial ledger entry ---
            player_courses_rev = sum(
                ts_info['daily']['przychod'] for ts_info in ts_agg.values()
            )
            player_wars_rev = sum(
                ts_info['daily'].get('warsRevenue', 0) for ts_info in ts_agg.values()
            )
            player_fines_rev = sum(
                ts_info['daily'].get('fineRevenue', 0) for ts_info in ts_agg.values()
            )
            player_operational = sum(
                ts_info['daily']['koszt'] for ts_info in ts_agg.values()
            )
            player_energy = sum(
                ts_info['daily'].get('energyCost', 0) for ts_info in ts_agg.values()
            )

            _write_daily_ledger(
                db, pid, date_str,
                revenues={
                    'courses': player_courses_rev,
                    'wars':    player_wars_rev,
                    'fines':   player_fines_rev,
                },
                costs={
                    'operational':    player_operational,
                    'energy':         player_energy,
                    'trackFees':      0,
                    'creditInterest': 0,
                },
            )

    batch.commit()
    print(f'Daily report saved: {date_str} — {written} player(s).')
    return written
