"""Księgowość dzienna i miesięczna operacji na koncie gracza i w logach financeLedger."""
import datetime as dt

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
