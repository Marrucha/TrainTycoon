"""Giełda akcji — wycena fundamentalna i aktualizacja cen rynkowych."""
import datetime
import math

# ── Stałe wyceny ────────────────────────────────────────────────────────────
FLEET_LIQUIDATION_HAIRCUT = 0.85  # 85% ceny katalogowej (15% utrata przy zakupie, reszta przez condition)
BASE_PE                   = 8
PE_MIN                    = 4
PE_MAX                    = 20
NAV_WEIGHT                = 0.40
EARNINGS_WEIGHT           = 0.60
FUNDAMENTAL_FLOOR         = 1_000_000   # PLN
PRICE_FLOOR               = 1.0         # PLN/akcja

PRESSURE_DECAY            = 0.50   # spada o 50% każdego game-dnia
PRICE_BAND_LOW            = 0.85   # -15% od fundamental
PRICE_BAND_HIGH           = 1.20   # +20% od fundamental (anty-fraud ceiling)
PRICE_HISTORY_MAX_DAYS    = 90

# ── Wymagania do notowania ──────────────────────────────────────────────────
LISTING_REQUIREMENTS = {
    'min_history_game_days': 14,
    'min_daily_revenue':    500_000,
    'min_daily_net':              0,
    'min_reputation':          0.35,
    'min_nav':                     0,
    'min_active_trainsets':       1,
    'require_free_float':      True,
}


# ── Helpers ─────────────────────────────────────────────────────────────────

def _compute_nav(db, pid, player_data):
    """Wartość aktywów netto firmy. Zwraca (nav, breakdown_dict)."""
    finance = player_data.get('finance') or {}
    cash = finance.get('balance', 0)

    # Depozyty (wartość nominalna)
    deposits = sum(
        (d.to_dict() or {}).get('amount', 0)
        for d in db.collection(f'players/{pid}/deposits').stream()
    )

    # Flota — cena z katalogu (trains/{parent_id}) × stan/100 × haircut
    # players/{pid}/trains zawiera tylko parent_id i condition — cena jest w bazowym dokumencie
    base_trains_cache = {}
    fleet_raw = 0
    for t in db.collection(f'players/{pid}/trains').stream():
        t_data    = t.to_dict() or {}
        parent_id = t_data.get('parent_id', '')
        if parent_id not in base_trains_cache:
            base_snap = db.collection('trains').document(parent_id).get()
            base_trains_cache[parent_id] = (base_snap.to_dict() or {}) if base_snap.exists else {}
        base      = base_trains_cache[parent_id]
        price     = base.get('price', 0)
        condition = t_data.get('condition', base.get('condition', 100))
        fleet_raw += price * (condition / 100)
    fleet_value = fleet_raw * FLEET_LIQUIDATION_HAIRCUT

    # Pozostały kapitał kredytów inwestycyjnych
    loans_remaining = 0
    for l in (finance.get('loans') or []):
        principal      = l.get('principal', 0)
        remaining      = l.get('remainingMonths', 0)
        monthly        = l.get('monthlyPayment', 0)
        total_to_repay = l.get('totalToRepay', 0) or monthly * remaining
        if total_to_repay > 0 and monthly > 0:
            original_months = total_to_repay / monthly
            loans_remaining += principal * (remaining / original_months)
        elif remaining > 0:
            loans_remaining += principal

    nav = cash + deposits + fleet_value - loans_remaining
    breakdown = {
        'navCash':         round(cash),
        'navDeposits':     round(deposits),
        'navFleetRaw':     round(fleet_raw),
        'navFleetHaircut': round(fleet_value),
        'navLoans':        round(loans_remaining),
        'navTotal':        round(nav),
    }
    return nav, breakdown


def _compute_trailing_earnings(db, pid, game_date, days=7):
    """Średni dzienny zysk netto z ostatnich `days` game-dni."""
    totals = []
    for i in range(1, days + 1):
        d = game_date - datetime.timedelta(days=i)
        rep = db.collection(f'players/{pid}/Raporty').document(d.isoformat()).get()
        if not rep.exists:
            continue
        day_net = sum(
            ts.get('daily', {}).get('netto', 0)
            for ts in (rep.to_dict() or {}).get('trainSets', {}).values()
        )
        totals.append(day_net)
    return sum(totals) / len(totals) if len(totals) >= 3 else 0


def _compute_revenue_growth(db, pid, game_date):
    """Wzrost przychodu z ostatnich 30 game-dni (ułamek dziesiętny)."""
    def rev_on(d):
        rep = db.collection(f'players/{pid}/Raporty').document(d.isoformat()).get()
        if not rep.exists:
            return 0
        return sum(
            ts.get('daily', {}).get('przychod', 0)
            for ts in (rep.to_dict() or {}).get('trainSets', {}).values()
        )

    rev_now  = rev_on(game_date - datetime.timedelta(days=1))
    rev_old  = rev_on(game_date - datetime.timedelta(days=30))
    if rev_old <= 0:
        return 0
    return (rev_now - rev_old) / rev_old


def _compute_fundamental_price(nav, trailing_daily_net, reputation, rev_growth_pct, total_shares):
    annualized_net = trailing_daily_net * 365
    rep_bonus    = reputation * 7
    growth_bonus = max(-3, min(5, rev_growth_pct * 10))
    pe_multiple  = max(PE_MIN, min(PE_MAX, BASE_PE + rep_bonus + growth_bonus))

    earnings_value = max(0, annualized_net) * pe_multiple
    has_earnings   = annualized_net > 0

    if has_earnings:
        fund_value = NAV_WEIGHT * nav + EARNINGS_WEIGHT * earnings_value
    else:
        fund_value = nav

    fund_value = max(FUNDAMENTAL_FLOOR, fund_value)
    price = max(PRICE_FLOOR, round(fund_value / max(1, total_shares), 2))
    return price, pe_multiple, nav, earnings_value


def _check_listing_eligibility(db, pid, player_data, game_date):
    """
    Sprawdza wymagania IPO.
    Zwraca (eligible: bool, checks: list[{label, passed, detail}])
    """
    checks = []
    finance = player_data.get('finance') or {}
    company = player_data.get('company') or {}

    def add(label, passed, detail=''):
        checks.append({'label': label, 'passed': passed, 'detail': detail})

    # 1. Historia konta
    req_days = LISTING_REQUIREMENTS['min_history_game_days']
    created_at = player_data.get('createdAt')
    if created_at:
        try:
            created  = datetime.date.fromisoformat(str(created_at)[:10])
            age_days = (game_date - created).days
            add(f'Historia konta (min. {req_days} game-dni)',
                age_days >= req_days,
                f'{age_days}/{req_days} dni')
        except Exception:
            pass  # pomijamy jeśli nie da się sparsować
    # brak createdAt — konto założone przed polem, pomijamy wymóg

    # 2. Przychody (ostatnie 7 dni)
    rev_days = []
    for i in range(1, 8):
        d = game_date - datetime.timedelta(days=i)
        rep = db.collection(f'players/{pid}/Raporty').document(d.isoformat()).get()
        if rep.exists:
            rev_days.append(sum(
                ts.get('daily', {}).get('przychod', 0)
                for ts in (rep.to_dict() or {}).get('trainSets', {}).values()
            ))
    avg_rev = sum(rev_days) / len(rev_days) if rev_days else 0
    req_rev = LISTING_REQUIREMENTS['min_daily_revenue']
    add(f'Śr. przychód dzienny (min. {req_rev:,} PLN)',
        avg_rev >= req_rev,
        f'{int(avg_rev):,} PLN/dzień')

    # 3. Zysk netto
    avg_net = _compute_trailing_earnings(db, pid, game_date, days=7)
    add('Firma nie jest na stracie',
        avg_net >= LISTING_REQUIREMENTS['min_daily_net'],
        f'{int(avg_net):,} PLN/dzień (śr. 7d)')

    # 4. Reputacja
    reputation = player_data.get('reputation', 0)
    req_rep = LISTING_REQUIREMENTS['min_reputation']
    add(f'Reputacja (min. {req_rep})',
        reputation >= req_rep,
        f'{reputation:.2f}')

    # 5. Aktywne składy
    active_ts = sum(
        1 for ts in db.collection(f'players/{pid}/trainSet').stream()
        if (ts.to_dict() or {}).get('rozklad')
    )
    req_ts = LISTING_REQUIREMENTS['min_active_trainsets']
    add(f'Aktywne składy w trasie (min. {req_ts})',
        active_ts >= req_ts,
        f'{active_ts} aktywnych')

    # 6. Wyemitowane akcje
    free_float = company.get('freeFloat', 0)
    add('Akcje w wolnym obrocie (emisja)',
        free_float > 0,
        f'{int(free_float):,} akcji')

    eligible = all(c['passed'] for c in checks)
    return eligible, checks


# ── Główna funkcja dzienna ──────────────────────────────────────────────────

def update_exchange_prices(db, game_date):
    """Wywołać z _check_game_day_rollover po update_hall_of_fame()."""
    if isinstance(game_date, str):
        game_date = datetime.date.fromisoformat(game_date)

    date_str = game_date.isoformat()

    # Pobierz wszystkich graczy z isListed=True
    for p_doc in db.collection('players').stream():
        pid  = p_doc.id
        if pid == 'samorządowy':
            continue
        data    = p_doc.to_dict() or {}
        company = data.get('company') or {}
        if not company.get('isListed'):
            continue

        total_shares = company.get('totalShares', 1_000_000)
        free_float   = company.get('freeFloat', 0)
        reputation   = data.get('reputation', 0)

        nav, nav_breakdown = _compute_nav(db, pid, data)
        trailing_net       = _compute_trailing_earnings(db, pid, game_date)
        rev_growth         = _compute_revenue_growth(db, pid, game_date)

        fund_price, pe_mult, nav_val, earn_val = _compute_fundamental_price(
            nav, trailing_net, reputation, rev_growth, total_shares
        )

        # Wczytaj bieżący dokument exchange
        ex_ref  = db.collection('exchange').document(pid)
        ex_snap = ex_ref.get()
        ex_data = ex_snap.to_dict() if ex_snap.exists else {}

        prev_pressure = ex_data.get('pressureAccumulator', 0)
        prev_price    = ex_data.get('marketPrice', fund_price)
        open_price    = prev_price

        # Decay presji
        new_pressure = prev_pressure * PRESSURE_DECAY

        # Nowa cena rynkowa
        raw_market = fund_price * (1 + new_pressure)
        market_price = max(
            fund_price * PRICE_BAND_LOW,
            min(fund_price * PRICE_BAND_HIGH, raw_market)
        )
        market_price = round(market_price, 2)

        # Liczba unikalnych udziałowców
        portfolio_snap = db.collection('portfolios').stream()
        unique_holders = sum(
            1 for p in portfolio_snap
            if pid in ((p.to_dict() or {}).get('holdings') or {})
            and ((p.to_dict() or {}).get('holdings') or {}).get(pid, {}).get('shares', 0) > 0
        )

        ex_ref.set({
            'ownerUid':           pid,
            'companyName':        data.get('companyName', ''),
            'isListed':           True,
            'fundamentalPrice':   fund_price,
            'marketPrice':        market_price,
            'prevDayPrice':       prev_price,
            'pressureAccumulator': new_pressure,
            'totalShares':        total_shares,
            'freeFloat':          free_float,
            'uniqueHolders':      unique_holders,
            'nav':                round(nav_val),
            'navBreakdown':       nav_breakdown,
            'earningsValue':      round(earn_val),
            'peMultiple':         round(pe_mult, 1),
            'trailingDailyNet':   round(trailing_net),
            'annualizedNet':      round(trailing_net * 365),
            'lastUpdated':        date_str,
        }, merge=True)

        # Historia cen
        hist_ref = ex_ref.collection('priceHistory').document(date_str)
        hist_snap = hist_ref.get()
        day_high = max(market_price, hist_snap.to_dict().get('high', market_price)) if hist_snap.exists else market_price
        day_low  = min(market_price, hist_snap.to_dict().get('low', market_price)) if hist_snap.exists else market_price
        day_vol  = hist_snap.to_dict().get('volume', 0) if hist_snap.exists else 0
        hist_ref.set({
            'date':            date_str,
            'fundamentalPrice': fund_price,
            'openPrice':       open_price,
            'closePrice':      market_price,
            'high':            day_high,
            'low':             day_low,
            'volume':          day_vol,
        })

        # Trim historii — usuń wpisy starsze niż PRICE_HISTORY_MAX_DAYS
        cutoff = (game_date - datetime.timedelta(days=PRICE_HISTORY_MAX_DAYS)).isoformat()
        old_entries = ex_ref.collection('priceHistory').where('date', '<', cutoff).stream()
        for old in old_entries:
            old.reference.delete()

        # Zaktualizuj totalPortfolioValue we wszystkich portfelach
        for port_doc in db.collection('portfolios').stream():
            port_pid  = port_doc.id
            port_data = port_doc.to_dict() or {}
            holdings  = port_data.get('holdings') or {}
            if pid not in holdings:
                continue
            total_val = sum(
                (holdings.get(company_uid) or {}).get('shares', 0) * market_price
                if company_uid == pid
                else (holdings.get(company_uid) or {}).get('shares', 0)
                     * _get_market_price(db, company_uid)
                for company_uid in holdings
            )
            db.collection('portfolios').document(port_pid).update({
                'totalPortfolioValue': round(total_val),
                'lastUpdated': date_str,
            })

    print(f"[exchange] Ceny zaktualizowane dla game_date={date_str}")


def _get_market_price(db, owner_uid):
    """Pomocnicze — bieżąca cena rynkowa z exchange/{uid}."""
    snap = db.collection('exchange').document(owner_uid).get()
    if snap.exists:
        return (snap.to_dict() or {}).get('marketPrice', 1.0)
    return 1.0
