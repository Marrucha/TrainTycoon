import datetime
import zoneinfo

def update_hall_of_fame(db, game_date=None):
    """
    Agreguje statystyki z raportów wszystkich aktywnych graczy.
    Zapisuje TOP wyniki każdej kategorii do wyznaczonej kolekcji publicznej w bazie, by Frontend mógł je łatwo odczytać.
    game_date: datetime.date representing current virtual game day (used to look up Raporty docs).
               Falls back to real Warsaw time if not provided.
    """
    now_waw = datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Warsaw'))

    if game_date is not None:
        base = game_date if isinstance(game_date, datetime.date) else datetime.date.fromisoformat(str(game_date))
    else:
        base = now_waw.date()

    today_str = base.strftime('%Y-%m-%d')
    yesterday_str = (base - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    week_str = (base - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
    month_str = (base - datetime.timedelta(days=30)).strftime('%Y-%m-%d')
    
    players = []
    
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
            
        data = p_doc.to_dict() or {}
        company_name = data.get('companyName', 'Nieznana Firma')
        finance = data.get('finance', {})
        balance = finance.get('balance', 0)
        
        # 1. Zliczanie pociągów (ilość posiadanych)
        trains_count = 0
        for _ in db.collection(f'players/{pid}/trains').stream():
            trains_count += 1
            
        # 2. Pobieranie raportów
        def get_report_totals(date_str):
            rep = db.collection(f'players/{pid}/Raporty').document(date_str).get()
            if not rep.exists:
                return {'km': 0, 'passengers': 0, 'demand': 0, 'revenue': 0, 'profit': 0}
            
            r_data = rep.to_dict() or {}
            ts_agg = r_data.get('trainSets', {})
            
            tot_km = 0
            tot_pax = 0
            tot_dem = 0
            tot_rev = 0
            tot_prof = 0
            
            for ts_val in ts_agg.values():
                daily = ts_val.get('daily', {})
                tot_km += daily.get('km', 0)
                tot_pax += daily.get('transferred', {}).get('total', 0)
                tot_dem += daily.get('totalDemand', {}).get('total', 0)
                tot_rev += daily.get('przychod', 0)
                tot_prof += daily.get('netto', 0)
                
            return {
                'km': tot_km,
                'passengers': tot_pax,
                'demand': tot_dem,
                'revenue': tot_rev,
                'profit': tot_prof
            }

        rep_today = get_report_totals(today_str)
        rep_yest = get_report_totals(yesterday_str)
        rep_week = get_report_totals(week_str)
        rep_month = get_report_totals(month_str)
        
        # 3. Wyliczanie przyrostów
        dem_growth_d = rep_today['demand'] - rep_yest['demand']
        dem_growth_w = rep_today['demand'] - rep_week['demand']
        dem_growth_m = rep_today['demand'] - rep_month['demand']
        
        rev_growth_d = rep_today['revenue'] - rep_yest['revenue']
        rev_growth_w = rep_today['revenue'] - rep_week['revenue']
        rev_growth_m = rep_today['revenue'] - rep_month['revenue']
        
        personal_balance = (data.get('personal') or {}).get('balance', 0)

        players.append({
            'pid': pid,
            'name': company_name,
            'trains': trains_count,
            'km': rep_today['km'],
            'passengers': rep_today['passengers'],
            'demand': rep_today['demand'],
            'revenue': rep_today['revenue'],
            'profit': rep_today['profit'],
            'equity': balance,
            'personal_wealth': personal_balance,
            'dem_grow_d': dem_growth_d,
            'dem_grow_w': dem_growth_w,
            'dem_grow_m': dem_growth_m,
            'rev_grow_d': rev_growth_d,
            'rev_grow_w': rev_growth_w,
            'rev_grow_m': rev_growth_m,
        })
        
    # Helpers do formatowania Topki wyników  
    def get_top(key, reverse=True, n=30):
        sorted_list = sorted(players, key=lambda x: x[key], reverse=reverse)
        return [{'pid': p['pid'], 'name': p['name'], 'val': p[key]} for p in sorted_list[:n]]

    # Słownik kompletnego Hall of Fame
    rankings = {
        'trains': get_top('trains'),
        'km': get_top('km'),
        'passengers': get_top('passengers'),
        'demand': get_top('demand'),
        'revenue': get_top('revenue'),
        'profit': get_top('profit'),
        'equity': get_top('equity'),
        'personal_wealth': get_top('personal_wealth'),
        'dem_grow_d': get_top('dem_grow_d'),
        'dem_grow_w': get_top('dem_grow_w'),
        'dem_grow_m': get_top('dem_grow_m'),
        'rev_grow_d': get_top('rev_grow_d'),
        'rev_grow_w': get_top('rev_grow_w'),
        'rev_grow_m': get_top('rev_grow_m'),
        'updatedAt': now_waw.isoformat()
    }
    
    # Rzut docelowy na globalny dokument
    db.collection('globalStats').document('hallOfFame').set(rankings)
    print(f"[!] Ranking Hall of Fame przeliczony dynamicznie dla {len(players)} pociągów.")
