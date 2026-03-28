import re

path_core = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/staff_core.py'
with open(path_core, 'r', encoding='utf-8') as f:
    core_code = f.read()

# Replace global vars
core_code = re.sub(r'SALARIES\s*=\s*\{.*?\n\}', '', core_code, flags=re.DOTALL)
core_code = re.sub(r'EXP_SALARY_RATES\s*=\s*\{.*?\n\}', '', core_code, flags=re.DOTALL)
core_code = re.sub(r'INTERN_SALARY\s*=\s*\d+\s*.*?\n', '', core_code)
core_code = re.sub(r'BASE_WARS_RATE\s*=\s*\d+\s*.*?\n', '', core_code)
core_code = core_code.replace("ROLES = list(SALARIES.keys())", "ROLES = ['maszynista', 'kierownik', 'pomocnik', 'konduktor', 'barman']")

# Update calc_evaluation_salary
core_code = core_code.replace('def calc_evaluation_salary(role: str, experience: float) -> int:', 'def calc_evaluation_salary(role: str, experience: float, constants: dict = None) -> int:')
core_code = core_code.replace('base = SALARIES.get(role, 5000)', "salaries = constants.get('SALARIES', {}) if constants else {}; base = salaries.get(role, 5000)")
core_code = core_code.replace('rate = EXP_SALARY_RATES.get(role, 0)', "rates = constants.get('EXP_SALARY_RATES', {}) if constants else {}; rate = rates.get(role, 0)")

# Update generate_candidate
core_code = core_code.replace('def generate_candidate(role: str) -> dict:', 'def generate_candidate(role: str, constants: dict = None) -> dict:')
core_code = core_code.replace('salary = SALARIES.get(role, 5000)', "salaries = constants.get('SALARIES', {}) if constants else {}; salary = salaries.get(role, 5000)")

with open(path_core, 'w', encoding='utf-8') as f:
    f.write(core_code)


path_staff = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/staff.py'
with open(path_staff, 'r', encoding='utf-8') as f:
    staff_code = f.read()

# Update staff
staff_code = staff_code.replace('def run_daily_staff(db):', "def run_daily_staff(db):\n    c_snap = db.collection('gameConfig').document('constants').get()\n    consts = c_snap.to_dict() or {} if c_snap.exists else {}")
staff_code = staff_code.replace('_generate_agency_lists(db)', '_generate_agency_lists(db, consts)')
staff_code = staff_code.replace('def _generate_agency_lists(db):', 'def _generate_agency_lists(db, consts=None):')
staff_code = staff_code.replace('cand = generate_candidate(', 'cand = generate_candidate(') # wait

# I'll just change generate_candidate(role) to generate_candidate(role, consts)
staff_code = staff_code.replace('for _ in range(count):\n                        cand = generate_candidate(role)', 'for _ in range(count):\n                        cand = generate_candidate(role, consts)')

staff_code = staff_code.replace('def run_monthly_staff(db, today=None):', "def run_monthly_staff(db, today=None):\n    c_snap = db.collection('gameConfig').document('constants').get()\n    consts = c_snap.to_dict() or {} if c_snap.exists else {}")
staff_code = staff_code.replace('_accrue_staff_salaries(db, today)', '_accrue_staff_salaries(db, today, consts)')
staff_code = staff_code.replace('def _accrue_staff_salaries(db, today):', 'def _accrue_staff_salaries(db, today, consts=None):')
staff_code = staff_code.replace('salary = calc_evaluation_salary(role, e.get(\'experience\', 0))', 'salary = calc_evaluation_salary(role, e.get(\'experience\', 0), consts)')
staff_code = staff_code.replace('salary = INTERN_SALARY', "salary = consts.get('INTERN_SALARY', 4300) if consts else 4300")

# And imports removal from staff.py
staff_code = re.sub(r'SALARIES,\s*EXP_SALARY_RATES,\s*INTERN_SALARY,\s*BASE_WARS_RATE,\s*', '', staff_code)

with open(path_staff, 'w', encoding='utf-8') as f:
    f.write(staff_code)


path_board = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/boarding_sim.py'
with open(path_board, 'r', encoding='utf-8') as f:
    board_code = f.read()

board_code = board_code.replace("fine_multiplier   = int(game_config.get('fineMultiplier',   _DEFAULT_FINE_MULTIPLIER))", "fine_multiplier   = int(game_config.get('fineMultiplier', 20))")
board_code = board_code.replace("penalty_min       = int(game_config.get('finePenaltyMinutes', _DEFAULT_PENALTY_MIN))", "penalty_min       = int(game_config.get('finePenaltyMinutes', 15))")
board_code = board_code.replace("cond_cap_per_hour = int(game_config.get('conductorPassengersPerHour', _DEFAULT_COND_CAP_PER_HOUR))", "cond_cap_per_hour = int(game_config.get('conductorPassengersPerHour', 100))")

board_code = board_code.replace("cond_cap_per_hour = int(game_config.get('conductorPassengersPerHour', 100))", "cond_cap_per_hour = int(game_config.get('conductorPassengersPerHour', 100))\n    c_snap = db.collection('gameConfig').document('constants').get()\n    consts = c_snap.to_dict() or {} if c_snap.exists else {}")

board_code = board_code.replace("_calc_min_segment_price(stops, cities)", "_calc_min_segment_price(stops, cities, consts.get('CLASS2_PER_100KM', 6))")
board_code = board_code.replace("calc_wars_revenue(total_on_board, barmans_exp, 20)  # using baseline 20", "calc_wars_revenue(total_on_board, barmans_exp, consts.get('BASE_WARS_RATE', 20))")

with open(path_board, 'w', encoding='utf-8') as f:
    f.write(board_code)

print("Backend constants patched.")
