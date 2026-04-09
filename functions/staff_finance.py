"""Księgowość dzienna i miesięczna operacji na koncie gracza i w logach financeLedger."""
import datetime as dt

LIFESTYLE_BASE = 10_000   # PLN/miesiąc stała opłata za styl życia CEO
LIFESTYLE_RATE = 0.01     # 1% majątku osobistego / miesiąc


def _pay_ceo_salary_and_lifestyle(db, today=None):
    """Wypłata wynagrodzenia CEO z kasy firmy do personal.balance + lifestyle tax.
    Uruchamiana raz na game-miesiąc (day == 1).
    """
    if today is None:
        today = dt.date.today()
    if today.day != 1:
        return

    for p_doc in db.collection('players').stream():
        pid = p_doc.id
        if pid == 'samorządowy':
            continue

        data = p_doc.to_dict() or {}
        company = data.get('company') or {}
        finance_balance = (data.get('finance') or {}).get('balance', 0)
        personal_balance = (data.get('personal') or {}).get('balance', 0)

        updates = {}

        # Oblicz pensję CEO: 30_000 + 0.1% zysku netto z zeszłego miesiąca
        ceo_salary = 30000
        
        first_of_this = today.replace(day=1)
        last_month_end = first_of_this - dt.timedelta(days=1)
        month_str = last_month_end.strftime('%Y-%m')
        
        last_month_snap = db.collection(f'players/{pid}/financeLedger').document(f'monthly-{month_str}').get()
        if last_month_snap.exists:
            net_res = last_month_snap.to_dict().get('netResult', 0)
            if net_res > 0:
                ceo_salary += int(net_res * 0.001)

        # 1. CEO salary: firma → osobisty
        if ceo_salary > 0 and finance_balance >= ceo_salary:
            updates['finance.balance'] = finance_balance - ceo_salary
            personal_balance += ceo_salary
            updates['personal.balance'] = personal_balance
            # Zapisz do ledgera firmy
            date_str = today.isoformat()
            ledger_ref = db.collection(f'players/{pid}/financeLedger').document(date_str)
            ledger_ref.set({'oneTimeCosts': [{'type': 'ceoSalary', 'amount': ceo_salary, 'desc': 'Wynagrodzenie CEO'}]}, merge=True)

        # 2. Lifestyle tax: z personal.balance
        lifestyle = round(LIFESTYLE_BASE + personal_balance * LIFESTYLE_RATE)
        lifestyle = min(lifestyle, personal_balance)   # nie może zejść poniżej 0
        if lifestyle > 0:
            personal_balance = max(0, personal_balance - lifestyle)
            updates['personal.balance'] = personal_balance

        if updates:
            db.collection('players').document(pid).update(updates)

def _write_daily_ledger(db, pid: str, date_str: str, revenues: dict, costs: dict, one_time=None):
    if one_time is None:
        one_time = []
    p_snap  = db.collection('players').document(pid).get()
    balance = ((p_snap.to_dict() or {}).get('finance') or {}).get('balance', 0)
    doc_ref = db.collection(f'players/{pid}/financeLedger').document(date_str)
    doc_ref.set({
        'date':         date_str,
        'revenues':     revenues,
        'costs':        costs,
        'oneTimeCosts': one_time,
        'balanceEnd':   balance,
    }, merge=True)

def _aggregate_monthly_ledger(db, today=None, constants=None):
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

        agg_rev   = {'courses': 0, 'wars': 0, 'fines': 0, 'depositInterest': 0}
        agg_costs = {
            'operational': 0, 'energy': 0, 'trackFees': 0, 'creditInterest': 0,
            'salaries': 0, 'ceoSalary': 0, 'loanPayments': 0, 'oneTime': 0,
        }

        for doc in docs:
            d = doc.to_dict() or {}
            for k in agg_rev:
                agg_rev[k] += int((d.get('revenues') or {}).get(k, 0))
            for k in ('operational', 'energy', 'trackFees', 'creditInterest'):
                agg_costs[k] += int((d.get('costs') or {}).get(k, 0))
            for ot in (d.get('oneTimeCosts') or []):
                amt = int(ot.get('amount', 0))
                if ot.get('type') == 'ceoSalary':
                    agg_costs['ceoSalary'] += amt
                else:
                    agg_costs['oneTime'] += amt

        monthly_salary = sum(
            (constants.get('INTERN_SALARY', 4300) if constants else 4300) if (e.to_dict() or {}).get('isIntern')
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
