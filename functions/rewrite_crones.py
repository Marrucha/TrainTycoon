import os
import re

def process_file(path, func):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f: content = f.read()
    result = func(content)
    with open(path, 'w', encoding='utf-8') as f: f.write(result)


# MAIN.PY refactor
def update_main(c):
    # Usunięcie starego crone'a daily
    c = re.sub(r"@scheduler_fn\.on_schedule.*?def calc_daily_demand.*?update_hall_of_fame\(db\)", "", c, flags=re.DOTALL)
    
    # Dodanie logiki zarządzania czasem ukrytej pod tick_boarding
    new_logic = """
@scheduler_fn.on_schedule(schedule='* * * * *', timezone='Europe/Warsaw')
def tick_boarding(event: scheduler_fn.ScheduledEvent) -> None:
    \"\"\"Cloud Function: live simulation of train stops & Virtual Time Cron.\"\"\"
    db = firestore.client()
    run_boarding_tick(db)
    _check_time_milestones(db)

def _check_time_milestones(db):
    import time
    from datetime import datetime, timezone
    
    c_snap = db.collection('gameConfig').document('constants').get()
    consts = c_snap.to_dict() or {} if c_snap.exists else {}
    real_start_ms = consts.get('REAL_START_TIME_MS')
    game_start_ms = consts.get('GAME_START_TIME_MS')
    multiplier    = consts.get('TIME_MULTIPLIER', 30)
    
    if not real_start_ms:
        return
        
    real_now_ms = int(time.time() * 1000)
    virt_now_ms = game_start_ms + (real_now_ms - real_start_ms) * multiplier
    
    last_daily_ms = consts.get('LAST_DAILY_TICK_VIRTUAL_MS')
    if not last_daily_ms:
        last_daily_ms = virt_now_ms
        db.collection('gameConfig').document('constants').update({'LAST_DAILY_TICK_VIRTUAL_MS': virt_now_ms})
        
    last_monthly_ms = consts.get('LAST_MONTHLY_TICK_VIRTUAL_MS')
    if not last_monthly_ms:
        last_monthly_ms = virt_now_ms
        db.collection('gameConfig').document('constants').update({'LAST_MONTHLY_TICK_VIRTUAL_MS': virt_now_ms})
        
    virt_date = datetime.fromtimestamp(virt_now_ms / 1000.0, timezone.utc)
    
    if virt_now_ms - last_daily_ms >= 86400000: # 1 Day
        db.collection('gameConfig').document('constants').update({'LAST_DAILY_TICK_VIRTUAL_MS': last_daily_ms + 86400000})
        save_daily_report(db, virt_date)
        _calc_daily_breakdowns(db)
        run_daily_staff(db, virt_date)
        update_reputation_metrics(db)
        update_hall_of_fame(db)
        
    if virt_now_ms - last_monthly_ms >= 2592000000: # 30 Days (virtual month)
        db.collection('gameConfig').document('constants').update({'LAST_MONTHLY_TICK_VIRTUAL_MS': last_monthly_ms + 2592000000})
        _accrue_credit_line_interest(db, virt_date)
        calc_demand_for_train_sets(db)
        run_monthly_staff(db, virt_date)
"""
    c = c.replace("""@scheduler_fn.on_schedule(schedule='* * * * *', timezone='Europe/Warsaw')
def tick_boarding(event: scheduler_fn.ScheduledEvent) -> None:
    \"\"\"Cloud Function: live simulation of train stops.\"\"\"
    db = firestore.client()
    run_boarding_tick(db)""", new_logic)

    # Zastąpienie today w accrue
    c = c.replace('def _accrue_credit_line_interest(db) -> None:', 'def _accrue_credit_line_interest(db, today=None) -> None:')
    c = c.replace('today = datetime.date.today()', 'today = today.date() if today else datetime.date.today()')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/main.py', update_main)


# STAFF.PY refactor
def update_staff(c):
    c = c.replace('def run_daily_staff(db):', 'def run_daily_staff(db, today=None):')
    c = c.replace('def _check_retirements(db):', 'def _check_retirements(db, today=None):')
    c = c.replace('_check_retirements(db)', '_check_retirements(db, today)')
    c = c.replace('today = dt.date.today()', 'today = today.date() if getattr(today, "date", None) else today if today else dt.date.today()')
    
    # Skasowanie blokady pierwszego dnia miesiaca! Zegar w main.py juz pilnuje miesiaca!
    c = c.replace('if today.day != 1:\n        return', '')
    
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/staff.py', update_staff)


# REPORTS.PY refactor
def update_reports(c):
    c = c.replace('def save_daily_report(db):', 'def save_daily_report(db, today=None):')
    c = c.replace('today = datetime.date.today()', 'today = today.date() if getattr(today, "date", None) else today if today else datetime.date.today()')
    return c
process_file('c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/reports.py', update_reports)


print("Cron jobs and scripts successfully ported to Virtual Time Engine.")
