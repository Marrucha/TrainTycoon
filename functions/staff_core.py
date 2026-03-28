"""Czysta matematyka i generatory domenowe dla logiki HR (bez pętli bazodanowych)."""
import math
import random
import datetime as dt


# PLN earned per 1 point of experience above base salary (monthly evaluation)


# Agency candidate experience distribution (cumulative probabilities)
_EXP_BUCKETS = [
    (0.50, 10, 25),
    (0.80, 25, 40),
    (0.95, 40, 55),
    (1.00, 55, 75),
]

ROLES = ['maszynista', 'kierownik', 'pomocnik', 'konduktor', 'barman']

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

def advance_exp(exp: float) -> float:
    return min(100.0, exp + (100.0 - exp) * 0.05)

def effective_exp(worker_exp: float, kierownik_exp: float) -> float:
    return min(100.0, worker_exp * (1.0 + kierownik_exp / 100.0))

def calc_gapowicze_delta(rate: float, n_kursy: int, n_cond: int, n_wagons: int, cond_exps=None, kierownik_exp: float = 0.0) -> float:
    if rate < 0.10:
        base = 0.005
    elif rate < 0.20:
        base = 0.004
    elif rate < 0.30:
        base = 0.003
    else:
        base = 0.001

    growth = base * n_kursy
    reduction = 0.0
    for i in range(n_cond):
        exp_i = float(cond_exps[i]) if cond_exps and i < len(cond_exps) else 0.0
        eff = effective_exp(exp_i, kierownik_exp)
        reduction += (1.0 / (2 ** i)) * base * n_kursy * (1.0 + eff / 100.0)

    uncovered = 0.0
    if n_wagons > 0:
        raw = (n_wagons - 6 * n_cond) / n_wagons
        uncovered = max(raw, 0.0) * base * n_kursy

    return growth - reduction + uncovered

def apply_gapowicze(rate: float, delta: float) -> float:
    return max(0.0, min(0.5, rate + delta))

def calc_fine_revenue(passengers: int, rate: float, n_cond: int, duration_min: int, penalty_min: int, fine_multiplier: int, min_segment_price: float) -> float:
    max_fines = n_cond * int(duration_min / penalty_min)
    evaders = round(passengers * rate)
    actual_fines = min(evaders, max_fines)
    return actual_fines * fine_multiplier * min_segment_price

def calc_wars_revenue(passengers: int, barmans_exp: list, base_rate: float) -> float:
    if not barmans_exp:
        return 0.0
    total_capacity = sum(500.0 * (1.0 + exp / 100.0) for exp in barmans_exp)
    served = min(float(passengers), total_capacity)
    load_ratio = served / total_capacity
    efficiency = 1.0 - 0.5 * load_ratio
    return served * base_rate * efficiency

def calc_inspection_index(n_cond: int, passengers: int, hours: float, cap_per_hour: int) -> float:
    conductor_cap = n_cond * cap_per_hour * hours
    return conductor_cap / max(passengers, 1)

def calc_raw_comfort(avg_idx: float) -> float:
    return max(0.0, min(10.0, 5.0 * (2.0 - avg_idx)))

def calc_evaluation_salary(role: str, experience: float, constants: dict = None) -> int:
    salaries = constants.get('SALARIES', {}) if constants else {}; base = salaries.get(role, 5000)
    rates = constants.get('EXP_SALARY_RATES', {}) if constants else {}; rate = rates.get(role, 0)
    return base + int(math.floor(experience)) * rate

def calc_severance(months: int, salary: float) -> float:
    if months > 36:
        return 3.0 * salary
    if months >= 12:
        return 2.0 * salary
    return salary

def generate_candidate_exp() -> int:
    r = random.random()
    for cum_prob, lo, hi in _EXP_BUCKETS:
        if r < cum_prob:
            return random.randint(lo, hi)
    return random.randint(55, 75)

def generate_candidate(role: str, constants: dict = None) -> dict:
    first  = random.choice(_FIRST_NAMES)
    last   = random.choice(_LAST_NAMES)
    exp    = generate_candidate_exp()
    salaries = constants.get('SALARIES', {}) if constants else {}; salary = salaries.get(role, 5000)

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
