"""finance_ops.py — codzienne operacje finansowe.

Zawiera logikę niezwiązaną bezpośrednio z Firebase Cloud Functions:
  - _get_game_date     — obliczanie aktualnej daty gry
  - _accrue_credit_line_interest — naliczanie odsetek linii kredytowej
  - _process_loan_payments       — miesięczne raty kredytów inwestycyjnych
  - _calc_daily_breakdowns       — losowanie awarii składów na dany dzień
"""

import calendar
import datetime
import random

from google.cloud.firestore_v1 import ArrayUnion


def _get_game_date(db):
    """Compute current game date from Firestore constants.
    Returns datetime.date or None if constants are missing."""
    constants_snap = db.collection('gameConfig').document('constants').get()
    if not constants_snap.exists:
        return None
    consts = constants_snap.to_dict() or {}
    real_start_ms = consts.get('REAL_START_TIME_MS')
    game_start_ms = consts.get('GAME_START_TIME_MS')
    multiplier = consts.get('TIME_MULTIPLIER', 30)
    if not real_start_ms or not game_start_ms:
        return None
    real_now_ms = datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000
    virtual_now_ms = game_start_ms + (real_now_ms - real_start_ms) * multiplier
    game_now = datetime.datetime.fromtimestamp(virtual_now_ms / 1000, tz=datetime.timezone.utc)
    return game_now.date()


def _accrue_credit_line_interest(db, today=None) -> None:
    """Deduct credit line costs from each player."""
    if today is None:
        today = datetime.date.today()
    players = db.collection('players').stream()
    for player_doc in players:
        data = player_doc.to_dict() or {}
        finance = data.get('finance', {})
        cl = finance.get('creditLine')
        if not cl:
            continue
        balance = finance.get('balance', 0)
        limit = cl['limit']
        used = max(0, limit - balance)
        daily_interest = round(used * cl.get('annualRate', 0.06) / 365)

        opened_day = datetime.date.fromisoformat(cl['openedAt'][:10]).day
        last_day_of_month = calendar.monthrange(today.year, today.month)[1]
        billing_day = min(opened_day, last_day_of_month)
        monthly_fee = round(limit * cl.get('commitmentRate', 0.01) / 12) if today.day == billing_day else 0

        total = daily_interest + monthly_fee
        if total > 0:
            player_doc.reference.update({'finance.balance': balance - total})


def _process_loan_payments(db, today=None) -> None:
    """1st of game-month: deduct monthly loan instalment and update remaining months."""
    if today is None:
        today = datetime.date.today()
    if today.day != 1:
        return

    for player_doc in db.collection('players').stream():
        pid = player_doc.id
        if pid == 'samorządowy':
            continue
        data = player_doc.to_dict() or {}
        finance = data.get('finance', {})
        loans = finance.get('loans', [])
        if not loans:
            continue

        balance = finance.get('balance', 0)
        total_payment = 0
        updated_loans = []

        for loan in loans:
            remaining = loan.get('remainingMonths', 0)
            if remaining <= 0:
                continue
            payment = round(loan.get('monthlyPayment', 0))
            total_payment += payment
            new_remaining = remaining - 1
            if new_remaining > 0:
                updated_loans.append({**loan, 'remainingMonths': new_remaining})

        if total_payment == 0:
            continue

        player_doc.reference.update({
            'finance.balance': balance - total_payment,
            'finance.loans': updated_loans,
        })

        date_str = today.isoformat()
        ledger_ref = db.collection(f'players/{pid}/financeLedger').document(date_str)
        ledger_ref.set({
            'date': date_str,
            'oneTimeCosts': ArrayUnion([{
                'type': 'loanPayment',
                'amount': total_payment,
                'desc': f'Rata kredytu ({len([l for l in loans if l.get("remainingMonths", 0) > 0])} kredytów)',
            }]),
        }, merge=True)


def _calc_daily_breakdowns(db) -> None:
    """Once per day: roll awaria probability per kurs for every trainSet."""
    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        player_trains = {d.id: d.to_dict() for d in db.collection(f'players/{pid}/trains').stream()}
        batch = db.batch()

        for ts_doc in db.collection(f'players/{pid}/trainSet').stream():
            ts_data = ts_doc.to_dict() or {}
            train_ids = ts_data.get('trainIds') or []
            conditions = [player_trains.get(tid, {}).get('condition', 1.0) for tid in train_ids]
            condition = sum(conditions) / len(conditions) if conditions else 1.0

            rozklad = ts_data.get('rozklad') or []
            kurs_ids = {str(s.get('kurs')) for s in rozklad if s.get('kurs') is not None}

            awarie = {}
            for kurs_id in kurs_ids:
                prob = (1 - condition) ** (1 / 5)
                if random.random() < prob:
                    awarie[kurs_id] = {'isAwaria': 1, 'awariaTime': random.randint(1, 59)}
                else:
                    awarie[kurs_id] = {'isAwaria': 0, 'awariaTime': 0}

            batch.update(ts_doc.reference, {'awarie': awarie})

        batch.commit()
