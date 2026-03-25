"""Staff and crew management system.

Pure functions (testable without Firestore):
  advance_exp, effective_exp, calc_gapowicze_delta, apply_gapowicze,
  calc_fine_revenue, calc_wars_revenue, calc_inspection_index,
  calc_raw_comfort, calc_severance, generate_candidate_exp, generate_candidate

Firestore functions (called from main.py daily scheduler):
  run_daily_staff(db)        — dispatches all daily staff tasks
  run_monthly_staff(db)      — dispatches all monthly staff tasks (day==1)
  _update_gapowicze(db)
  _generate_agency_lists(db)
  _accrue_staff_salaries(db)
  _advance_experience_all(db)
  _write_daily_ledger(db, pid, date_str, revenues, costs, one_time)
  _aggregate_monthly_ledger(db)
"""

import math
import random
import datetime as dt

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SALARIES = {
    'maszynista': 9000,
    'kierownik':  7000,
    'pomocnik':   6000,
    'konduktor':  5000,
    'barman':     4500,
}
# PLN earned per 1 point of experience above base salary (monthly evaluation)
EXP_SALARY_RATES = {
    'maszynista': 100,
    'pomocnik':   80,
    'kierownik':  70,
    'konduktor':  60,
    'barman':     50,
}
INTERN_SALARY  = 4300   # PLN/month – minimum wage
BASE_WARS_RATE = 20     # PLN per passenger (Wars wagon baseline)

# Agency candidate experience distribution (cumulative probabilities)
_EXP_BUCKETS = [
    (0.50, 10, 25),
    (0.80, 25, 40),
    (0.95, 40, 55),
    (1.00, 55, 75),
]

ROLES = list(SALARIES.keys())

_FIRST_NAMES = [
    'Adam', 'Piotr', 'Marek', 'Tomasz', 'Andrzej', 'Krzysztof', 'Michał',
    'Paweł', 'Łukasz', 'Grzegorz', 'Jan', 'Robert', 'Mariusz', 'Kamil',
    'Bartosz', 'Marcin', 'Jarosław', 'Dariusz', 'Mateusz', 'Rafał',
    'Anna', 'Katarzyna', 'Małgorzata', 'Agnieszka', 'Barbara', 'Ewa',
    'Maria', 'Monika', 'Joanna', 'Beata',
]
_LAST_NAMES = [
    'Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński',
    'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski',
    'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk',
    'Grabowski', 'Nowakowski', 'Pawlak', 'Michalski', 'Adamczyk',
    'Dudek', 'Zając', 'Wieczorek', 'Jabłoński', 'Kaczmarek', 'Sobczak',
    'Czajkowski', 'Baran', 'Zawadzki',
]

# ---------------------------------------------------------------------------
# Pure helper functions (no Firestore dependency – fully unit-testable)
# ---------------------------------------------------------------------------

def advance_exp(exp: float) -> float:
    """Advance employee experience by one month: exp += (100-exp)*0.05."""
    return min(100.0, exp + (100.0 - exp) * 0.05)


def effective_exp(worker_exp: float, kierownik_exp: float) -> float:
    """Return experience boosted by kierownik (train manager) multiplier."""
    return min(100.0, worker_exp * (1.0 + kierownik_exp / 100.0))


def calc_gapowicze_delta(
    rate: float,
    n_kursy: int,
    n_cond: int,
    n_wagons: int,
    cond_exps=None,
    kierownik_exp: float = 0.0,
) -> float:
    """Calculate the daily change in gapowicze (fare evasion) rate.

    Args:
        rate:         current gapowicze rate  (0.0 – 0.5)
        n_kursy:      number of daily courses
        n_cond:       conductors assigned
        n_wagons:     wagons in the trainSet
        cond_exps:    list of conductor raw experience values  (0-100)
        kierownik_exp: kierownik experience (boosts conductor effectiveness)

    Returns:
        delta to add to current rate (can be negative = improvement)
    """
    if rate < 0.10:
        base = 0.005
    elif rate < 0.20:
        base = 0.004
    elif rate < 0.30:
        base = 0.003
    else:
        base = 0.001

    growth = base * n_kursy

    # Each conductor reduces gapowicze; each successive one is half as effective.
    # Experience (boosted by kierownik) multiplies the reduction.
    reduction = 0.0
    for i in range(n_cond):
        exp_i = float(cond_exps[i]) if cond_exps and i < len(cond_exps) else 0.0
        eff = effective_exp(exp_i, kierownik_exp)
        reduction += (1.0 / (2 ** i)) * base * n_kursy * (1.0 + eff / 100.0)

    # Wagons not covered by any conductor generate extra gapowicze.
    uncovered = 0.0
    if n_wagons > 0:
        raw = (n_wagons - 6 * n_cond) / n_wagons
        uncovered = max(raw, 0.0) * base * n_kursy

    return growth - reduction + uncovered


def apply_gapowicze(rate: float, delta: float) -> float:
    """Apply delta and clamp rate to [0.0, 0.5]."""
    return max(0.0, min(0.5, rate + delta))


def calc_fine_revenue(
    passengers: int,
    rate: float,
    n_cond: int,
    duration_min: int,
    penalty_min: int,
    fine_multiplier: int,
    min_segment_price: float,
) -> float:
    """Revenue from fines issued during a single course.

    One conductor can issue 1 fine per `penalty_min` minutes of the course.
    """
    max_fines = n_cond * int(duration_min / penalty_min)
    evaders = round(passengers * rate)
    actual_fines = min(evaders, max_fines)
    return actual_fines * fine_multiplier * min_segment_price


def calc_wars_revenue(
    passengers: int,
    barmans_exp: list,
    base_rate: float,
) -> float:
    """Wars (restaurant car) revenue.

    Efficiency drops linearly from 1.0 (empty) to 0.5 (at max capacity).
    Passengers beyond total capacity generate no revenue.

    Args:
        passengers:  total passengers on the course
        barmans_exp: list of effective experience values (0-100) per barman
        base_rate:   PLN per served passenger at full efficiency
    """
    if not barmans_exp:
        return 0.0
    total_capacity = sum(500.0 * (1.0 + exp / 100.0) for exp in barmans_exp)
    served = min(float(passengers), total_capacity)
    load_ratio = served / total_capacity
    efficiency = 1.0 - 0.5 * load_ratio   # 1.0 at empty, 0.5 at full
    return served * base_rate * efficiency


def calc_inspection_index(
    n_cond: int,
    passengers: int,
    hours: float,
    cap_per_hour: int,
) -> float:
    """Inspection coverage index: conductor capacity / actual passengers.

    < 1  → under-inspected (good for passenger comfort)
    = 1  → neutral
    > 1  → over-inspected (bad for comfort)
    """
    conductor_cap = n_cond * cap_per_hour * hours
    return conductor_cap / max(passengers, 1)


def calc_raw_comfort(avg_idx: float) -> float:
    """Convert average inspection index to raw comfort score (0 – 10).

    idx=0  → 10 pts (no inspections, max comfort)
    idx=1  →  5 pts (neutral)
    idx≥2  →  0 pts (over-inspected, min comfort)
    """
    return max(0.0, min(10.0, 5.0 * (2.0 - avg_idx)))


def calc_evaluation_salary(role: str, experience: float) -> int:
    """Calculate monthly salary after evaluation: base + floor(exp) * rate."""
    base = SALARIES.get(role, 5000)
    rate = EXP_SALARY_RATES.get(role, 0)
    return base + int(math.floor(experience)) * rate


def calc_severance(months: int, salary: float) -> float:
    """Severance pay: 3 salaries if employed > 3 years, else 1 salary."""
    return 3.0 * salary if months > 36 else salary


def generate_candidate_exp() -> int:
    """Generate a candidate's experience using the weighted 4-bucket distribution."""
    r = random.random()
    for cum_prob, lo, hi in _EXP_BUCKETS:
        if r < cum_prob:
            return random.randint(lo, hi)
    return random.randint(55, 75)


def generate_candidate(role: str) -> dict:
    """Generate a random agency candidate for the given role."""
    first  = random.choice(_FIRST_NAMES)
    last   = random.choice(_LAST_NAMES)
    exp    = generate_candidate_exp()
    salary = SALARIES.get(role, 5000)

    today     = dt.date.today()
    min_age   = max(25, 20 + int(exp * 0.35))
    max_age   = min(62, min_age + 12)
    age       = random.randint(min_age, max_age)
    dob_year  = today.year - age
    dob_month = random.randint(1, 12)
    dob_day   = random.randint(1, 28)
    date_of_birth = f'{dob_year}-{dob_month:02d}-{dob_day:02d}'

    return {
        'name':          f'{first} {last}',
        'role':          role,
        'experience':    float(exp),
        'monthlySalary': salary,
        'dateOfBirth':   date_of_birth,
    }


# ---------------------------------------------------------------------------
# Firestore functions
# ---------------------------------------------------------------------------

def run_daily_staff(db):
    """Dispatch all daily staff-related tasks."""
    _update_gapowicze(db)
    _generate_agency_lists(db)
    _update_intern_status(db)
    _check_retirements(db)


def run_monthly_staff(db, today=None):
    """Dispatch monthly staff tasks (only executes on the 1st of the month)."""
    if today is None:
        today = dt.date.today()
    if today.day != 1:
        return
    _accrue_staff_salaries(db, today)
    _advance_experience_all(db, today)
    _monthly_evaluation(db, today)
    _aggregate_monthly_ledger(db, today)


# --------------- Internal Firestore helpers --------------------------------

def _unassign_emp_from_crew(db, pid: str, emp_id: str, assigned_to: str):
    """Remove emp_id from all crew fields in the given trainSet."""
    ts_ref  = db.collection(f'players/{pid}/trainSet').document(assigned_to)
    ts_snap = ts_ref.get()
    if not ts_snap.exists:
        return
    crew    = (ts_snap.to_dict() or {}).get('crew') or {}
    updates = {}
    for field, val in crew.items():
        if isinstance(val, list) and emp_id in val:
            updates[f'crew.{field}'] = [x for x in val if x != emp_id]
        elif val == emp_id:
            updates[f'crew.{field}'] = None
    if updates:
        ts_ref.update(updates)


def _check_retirements(db):
    """Daily: delete employees who have reached retirement age (65)."""
    today = dt.date.today()
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
        for emp_doc in db.collection(f'players/{pid}/kadry').stream():
            e       = emp_doc.to_dict() or {}
            dob_str = e.get('dateOfBirth')
            if not dob_str:
                continue
            dob = dt.date.fromisoformat(dob_str[:10])
            retirement = dob.replace(year=dob.year + 65)
            if today >= retirement:
                assigned_to = e.get('assignedTo')
                if assigned_to:
                    _unassign_emp_from_crew(db, pid, emp_doc.id, assigned_to)
                emp_doc.reference.delete()

def _update_gapowicze(db):
    """Update gapowiczeRate on every trainSet for every player."""
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        emp_map = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/kadry').stream()}

        batch = db.batch()
        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            ts     = ts_doc.to_dict() or {}
            crew   = ts.get('crew') or {}
            rozklad = ts.get('rozklad') or []

            kurs_ids = {str(s.get('kurs')) for s in rozklad if s.get('kurs') is not None}
            n_kursy  = len(kurs_ids)
            if n_kursy == 0:
                continue

            n_wagons = len(ts.get('trainIds') or [])

            cond_ids  = crew.get('konduktorzy') or []
            n_cond    = len(cond_ids)
            cond_exps = [emp_map.get(eid, {}).get('experience', 0.0) for eid in cond_ids]

            kierownik_id  = crew.get('kierownik')
            kierownik_exp = emp_map.get(kierownik_id, {}).get('experience', 0.0) if kierownik_id else 0.0

            eff_cond_exps = [effective_exp(e, kierownik_exp) for e in cond_exps]

            current_rate = float(ts.get('gapowiczeRate', 0.0))
            delta = calc_gapowicze_delta(
                rate=current_rate,
                n_kursy=n_kursy,
                n_cond=n_cond,
                n_wagons=n_wagons,
                cond_exps=eff_cond_exps,
                kierownik_exp=0.0,   # already applied inside effective_exp
            )
            new_rate = apply_gapowicze(current_rate, delta)
            batch.update(ts_doc.reference, {'gapowiczeRate': new_rate})

        batch.commit()


def _generate_agency_lists(db):
    """Daily: generate ~12 fresh agency candidates per player."""
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        candidates = []
        for role in ROLES:
            candidates.append(generate_candidate(role))   # 1 per role = 5
            candidates.append(generate_candidate(role))   # 2nd per role = 10
        # 2 extra random roles → 12 total
        for _ in range(2):
            candidates.append(generate_candidate(random.choice(ROLES)))

        random.shuffle(candidates)
        p_doc.reference.update({'agencyList': candidates})


def _update_intern_status(db):
    """Daily: graduate interns who have completed their 1-year training."""
    today = dt.date.today()
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
        for emp_doc in db.collection(f'players/{pid}/kadry').stream():
            e = emp_doc.to_dict() or {}
            if not e.get('isIntern'):
                continue
            grad_str = e.get('internGraduatesAt')
            if not grad_str:
                continue
            grad_date = dt.date.fromisoformat(grad_str[:10])
            if today >= grad_date:
                role = e.get('role', 'konduktor')
                emp_doc.reference.update({
                    'isIntern':          False,
                    'experience':        0.0,
                    'monthlySalary':     SALARIES.get(role, 5000),
                    'internGraduatesAt': None,
                })


def _accrue_staff_salaries(db, today=None):
    """1st of month: deduct all employee salaries from player balance."""
    if today is None:
        today = dt.date.today()
    if today.day != 1:
        return

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        employees = list(db.collection(f'players/{pid}/kadry').stream())
        total_salary = 0
        for emp in employees:
            e = emp.to_dict() or {}
            if e.get('isIntern'):
                total_salary += INTERN_SALARY
            else:
                total_salary += e.get('monthlySalary', SALARIES.get(e.get('role', ''), 0))

        if total_salary > 0:
            p_data  = p_doc.to_dict() or {}
            balance = (p_data.get('finance') or {}).get('balance', 0)
            p_doc.reference.update({'finance.balance': balance - total_salary})


def _advance_experience_all(db, today=None):
    """1st of month: advance experience for all active (non-intern) employees."""
    if today is None:
        today = dt.date.today()
    if today.day != 1:
        return

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
        for emp_doc in db.collection(f'players/{pid}/kadry').stream():
            e = emp_doc.to_dict() or {}
            if e.get('isIntern'):
                continue   # interns don't accumulate experience yet
            new_exp = advance_exp(e.get('experience', 0.0))
            emp_doc.reference.update({'experience': new_exp})


def _monthly_evaluation(db, today=None):
    """1st of month: update monthlySalary based on accumulated experience."""
    if today is None:
        today = dt.date.today()
    if today.day != 1:
        return

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue
        for emp_doc in db.collection(f'players/{pid}/kadry').stream():
            e = emp_doc.to_dict() or {}
            if e.get('isIntern'):
                continue
            role = e.get('role', '')
            exp  = e.get('experience', 0.0)
            new_salary = calc_evaluation_salary(role, exp)
            emp_doc.reference.update({'monthlySalary': new_salary})


def _write_daily_ledger(db, pid: str, date_str: str, revenues: dict, costs: dict, one_time=None):
    """Write (or merge) a daily financial ledger entry.

    Args:
        revenues:  {'courses': int, 'wars': int, 'fines': int}
        costs:     {'operational': int, 'trackFees': int, 'creditInterest': int}
        one_time:  list of {'type': str, 'amount': int, 'desc': str}
    """
    if one_time is None:
        one_time = []

    p_snap  = db.collection('players').document(pid).get()
    balance = ((p_snap.to_dict() or {}).get('finance') or {}).get('balance', 0)

    doc_ref = db.collection(f'players/{pid}/financeLedger').document(date_str)
    # Use set with merge so concurrent one-time cost writes don't overwrite each other
    doc_ref.set({
        'date':         date_str,
        'revenues':     revenues,
        'costs':        costs,
        'oneTimeCosts': one_time,
        'balanceEnd':   balance,
    })


def _aggregate_monthly_ledger(db, today=None):
    """1st of month: aggregate previous month's daily records into a monthly summary."""
    if today is None:
        today = dt.date.today()
    if today.day != 1:
        return

    first_of_this = today.replace(day=1)
    last_month_end = first_of_this - dt.timedelta(days=1)
    month_str = last_month_end.strftime('%Y-%m')

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        ledger_ref = db.collection(f'players/{pid}/financeLedger')
        docs = list(
            ledger_ref
            .where('date', '>=', month_str + '-01')
            .where('date', '<=', month_str + '-31')
            .stream()
        )

        agg_rev   = {'courses': 0, 'wars': 0, 'fines': 0}
        agg_costs = {
            'operational': 0, 'trackFees': 0, 'creditInterest': 0,
            'salaries': 0, 'loanPayments': 0, 'oneTime': 0,
        }

        for doc in docs:
            d = doc.to_dict() or {}
            for k in agg_rev:
                agg_rev[k] += int((d.get('revenues') or {}).get(k, 0))
            for k in ('operational', 'trackFees', 'creditInterest'):
                agg_costs[k] += int((d.get('costs') or {}).get(k, 0))
            for ot in (d.get('oneTimeCosts') or []):
                agg_costs['oneTime'] += int(ot.get('amount', 0))

        # Monthly salaries for current employees
        monthly_salary = sum(
            INTERN_SALARY if (e.to_dict() or {}).get('isIntern')
            else (e.to_dict() or {}).get('monthlySalary', 0)
            for e in db.collection(f'players/{pid}/kadry').stream()
        )
        agg_costs['salaries'] = monthly_salary

        total_rev   = sum(agg_rev.values())
        total_costs = sum(agg_costs.values())
        net         = total_rev - total_costs

        p_data  = p_doc.to_dict() or {}
        balance = (p_data.get('finance') or {}).get('balance', 0)

        ledger_ref.document(f'monthly-{month_str}').set({
            'month':      month_str,
            'revenues':   {**agg_rev, 'total': total_rev},
            'costs':      {**agg_costs, 'total': total_costs},
            'netResult':  net,
            'balanceEnd': balance,
        })
