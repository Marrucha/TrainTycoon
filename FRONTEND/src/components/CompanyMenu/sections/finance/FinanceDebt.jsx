import styles from '../../CompanyMenu.module.css'

const fmt = (n) => Math.round(n).toLocaleString('pl-PL')

const LOAN_OPTIONS = [
    { amt: 20000000,  label: '20 mln',  rate: '5.0%' },
    { amt: 50000000,  label: '50 mln',  rate: '5.2%' },
    { amt: 100000000, label: '100 mln', rate: '5.4%' },
    { amt: 200000000, label: '200 mln', rate: '5.6%' },
]

export default function FinanceDebt({ budget, playerDoc, openCreditLine, takeLoan, toggleGroup, expandedGroups }) {
    return (
        <section className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Instrumenty Dłużne</h3>
                <span style={{ fontSize: '12px', color: '#666' }}>Zdolność: 500.000.000 PLN</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* Linia kredytowa */}
                <div style={{ background: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>Linia Kredytowa (100 mln)</span>
                        <span style={{ fontSize: '13px', color: '#888' }}>6% rocznie</span>
                    </div>
                    {playerDoc.finance?.creditLine ? (() => {
                        const cl = playerDoc.finance.creditLine
                        const used = Math.max(0, cl.limit - budget)
                        const monthlyCommitment = Math.round(cl.limit * (cl.commitmentRate ?? 0.01) / 12)
                        const dailyInterest = Math.round(used * (cl.annualRate ?? 0.06) / 365)
                        return (
                            <div style={{ padding: '12px', background: 'rgba(18, 38, 18, 0.85)', border: '1px solid rgba(46, 204, 113, 0.35)', borderLeft: '4px solid #2ecc71', borderRadius: '8px', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>AKTYWNA</span>
                                    <span>Użyte: {fmt(used)} PLN</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e74c3c' }}>
                                    <span>Opłata za gotowość (1% p.a.)</span>
                                    <span>−{fmt(monthlyCommitment)} PLN/m-c</span>
                                </div>
                                {dailyInterest > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e74c3c' }}>
                                        <span>Odsetki od użytej kwoty (6% p.a.)</span>
                                        <span>−{fmt(dailyInterest)} PLN/dzień</span>
                                    </div>
                                )}
                            </div>
                        )
                    })() : (
                        <button className={styles.saveBtn} style={{ width: '100%', padding: '8px', fontSize: '11px', margin: '5px 0 0 0' }} onClick={() => openCreditLine(100000000)}>
                            Otwórz Linię
                        </button>
                    )}
                </div>

                {/* Kredyty inwestycyjne */}
                <div style={{ background: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>Kredyty Inwestycyjne</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>Spłata: 24 m-ce</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {LOAN_OPTIONS.map((loan, idx) => (
                            <button key={`${loan.amt}-${idx}`} className={styles.loanBtn}
                                style={{ padding: '6px', fontSize: '10px', margin: 0, display: 'flex', flexDirection: 'column', height: 'auto', alignItems: 'center' }}
                                onClick={() => takeLoan(loan.amt, 24)}>
                                <span style={{ fontWeight: '800', color: '#f0c040' }}>{loan.label}</span>
                                <span style={{ color: '#8aab8a', fontSize: '9px', fontWeight: '600' }}>Koszt: {loan.rate}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Aktywne kredyty */}
                {playerDoc.finance?.loans?.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                        <h4 style={{ fontSize: '11px', color: '#8aab8a', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Aktywne Kredyty</h4>
                        {playerDoc.finance.loans.map((loan, idx) => (
                            <div key={loan.id || idx} style={{ background: 'rgba(18, 38, 18, 0.85)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden', border: '1px solid rgba(46,204,113,0.3)', borderLeft: '4px solid #f0c040', boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}>
                                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                    onClick={() => toggleGroup(`loan-${loan.id}`)}>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#fff' }}>Kredyt #{loan.id.slice(-4)}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#f0c040' }}>Pozostało: {loan.remainingMonths} m-cy</span>
                                </div>
                                {expandedGroups[`loan-${loan.id}`] && (
                                    <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                                            <span style={{ color: '#888' }}>Kwota raty:</span>
                                            <span style={{ color: '#fff', fontWeight: '700' }}>{fmt(loan.monthlyPayment)} PLN</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                            <span style={{ color: '#888' }}>Do spłaty łącznie:</span>
                                            <span style={{ color: '#fff' }}>{fmt(loan.totalToRepay)} PLN</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
