"""Staff and crew management system.

Pure functions (testable without Firestore):
  advance_exp, effective_exp, calc_gapowicze_delta, apply_gapowicze,
  calc_fine_revenue, calc_wars_revenue, calc_inspection_index,
  calc_raw_comfort, calc_severance, generate_candidate_exp, generate_candidate

Firestore functions (called from main.py daily scheduler):
  run_daily_staff(db)        — dispatches all daily staff tasks
  run_monthly_staff(db)      — dispatches all monthly staff tasks (day==1)
  _update_gapowicze(db)
  _generate_agency_lists(db, consts)
  _accrue_staff_salaries(db)
  _advance_experience_all(db)
  _write_daily_ledger(db, pid, date_str, revenues, costs, one_time)
  _aggregate_monthly_ledger(db)
"""

import datetime as dt
import random

from staff_core import (
    ROLES,
    advance_exp, effective_exp, calc_gapowicze_delta, apply_gapowicze,
    calc_fine_revenue, calc_wars_revenue, calc_inspection_index,
    calc_raw_comfort, calc_evaluation_salary, calc_severance,
    generate_candidate_exp, generate_candidate
)
from staff_finance import _write_daily_ledger, _aggregate_monthly_ledger, _pay_ceo_salary_and_lifestyle


# ---------------------------------------------------------------------------
# Firestore functions
# ---------------------------------------------------------------------------

def run_daily_staff(db):
    c_snap = db.collection('gameConfig').document('constants').get()
    consts = c_snap.to_dict() or {} if c_snap.exists else {}
    """Dispatch all daily staff-related tasks."""
    _update_gapowicze(db)
    _generate_agency_lists(db, consts)
    _advance_intern_experience(db)
    _update_intern_status(db)
    _check_retirements(db)


def run_monthly_staff(db, today=None):
    c_snap = db.collection('gameConfig').document('constants').get()
    consts = c_snap.to_dict() or {} if c_snap.exists else {}
    """Dispatch monthly staff tasks (only executes on the 1st of the month)."""
    if today is None:
        today = dt.date.today()
    
    _accrue_staff_salaries(db, today, consts)
    _advance_experience_all(db, today)
    _monthly_evaluation(db, today)
    _pay_ceo_salary_and_lifestyle(db, today)
    _aggregate_monthly_ledger(db, today, consts)


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


def _generate_agency_lists(db, consts):
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


def _advance_intern_experience(db):
    """Daily: grow intern experience based on mentor's experience.

    Formula: daily_gain = mentor.experience / 5 / 365
    This means after 1 year: intern.experience = mentor.experience / 5
    (e.g. mentor exp=100 → intern gains 20; mentor exp=10 → intern gains 2)
    Only applies when intern has a mentorId set.
    """
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        # Build mentor exp lookup
        emp_docs = list(db.collection(f'players/{pid}/kadry').stream())
        mentor_exp = {
            d.id: (d.to_dict() or {}).get('experience', 0.0)
            for d in emp_docs
            if not (d.to_dict() or {}).get('isIntern')
        }

        for emp_doc in emp_docs:
            e = emp_doc.to_dict() or {}
            if not e.get('isIntern'):
                continue
            mentor_id = e.get('mentorId')
            if not mentor_id:
                continue   # no mentor → time doesn't count
            m_exp = mentor_exp.get(mentor_id, 0.0)
            daily_gain = m_exp / 5.0 / 365.0
            if daily_gain <= 0:
                continue
            new_exp = round(e.get('experience', 0.0) + daily_gain, 4)
            emp_doc.reference.update({'experience': new_exp})


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
                role      = e.get('role', 'konduktor')
                ts_id     = e.get('assignedTo')
                emp_doc.reference.update({
                    'isIntern':          False,
                    'monthlySalary':     SALARIES.get(role, 5000),
                    'internGraduatesAt': None,
                    'mentorId':          None,
                    'assignedTo':        None,   # free to be properly assigned to a role
                })
                # Remove from crew.stazysci of their trainSet
                if ts_id:
                    from google.cloud.firestore_v1 import ArrayRemove
                    ts_ref = db.collection(f'players/{pid}/trainSet').document(ts_id)
                    ts_ref.update({'crew.stazysci': ArrayRemove([emp_doc.id])})


def _accrue_staff_salaries(db, today=None):
    """1st of month: deduct all employee salaries from player balance."""
    if today is None:
        today = dt.date.today()
    

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

            # Record salary cost in financeLedger for this day
            from google.cloud.firestore_v1 import ArrayUnion
            n_emp = len(employees)
            ledger_ref = db.collection(f'players/{pid}/financeLedger').document(today.isoformat())
            ledger_ref.set({
                'oneTimeCosts': ArrayUnion([{'type': 'salaries', 'amount': total_salary,
                                             'desc': f'Pensje pracowników ({n_emp} os.)'}]),
            }, merge=True)


def _advance_experience_all(db, today=None):
    """1st of month: advance experience for all active (non-intern) employees."""
    if today is None:
        today = dt.date.today()
    

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



