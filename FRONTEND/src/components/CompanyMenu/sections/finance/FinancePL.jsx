import { useState } from 'react'
import { useGame } from '../../../../context/GameContext'
import styles from '../../CompanyMenu.module.css'

const fmt = (n) => Math.round(n).toLocaleString('pl-PL')

const PLRow = ({ label, value, color, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
        <span style={{ color: '#999' }}>{label}</span>
        <span style={{ color: color || '#ddd', fontWeight: bold ? 700 : 400, fontFamily: 'Share Tech Mono, monospace' }}>
            {bold && value >= 0 ? '+' : ''}{fmt(value)} PLN
        </span>
    </div>
)

export default function FinancePL() {
    const { financeLedger = [] } = useGame()
    const [plExpanded, setPlExpanded] = useState(false)
    const [plView, setPlView] = useState('daily')

    const dailyDocs   = financeLedger.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
    const monthlyDocs = financeLedger.filter(d => d.id?.startsWith('monthly-'))

    const latestMonthly = monthlyDocs[0]
    const summaryRev = latestMonthly
        ? (latestMonthly.revenues?.total ?? 0)
        : dailyDocs.reduce((s, d) => s + (d.revenues ? Object.values(d.revenues).reduce((a,b)=>a+b,0) : 0), 0)
    const summaryCost = latestMonthly
        ? (latestMonthly.costs?.total ?? 0)
        : dailyDocs.reduce((s, d) => {
            const costsSum = d.costs ? Object.values(d.costs).reduce((a,b)=>a+b,0) : 0
            const otSum    = (d.oneTimeCosts || []).reduce((a,b) => a + (b.amount || 0), 0)
            return s + costsSum + otSum
        }, 0)
    const summaryNet = summaryRev - summaryCost

    return (
        <div className={styles.grid} style={{ marginTop: 8 }}>
            <section className={styles.card} style={{ gridColumn: 'span 2', cursor: 'pointer' }} onClick={() => setPlExpanded(v => !v)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Rachunek Zysków i Strat</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.5 }}>
                            <div><span style={{ color: '#888' }}>Przychody: </span><span style={{ color: '#2ecc71' }}>{fmt(summaryRev)} PLN</span></div>
                            <div><span style={{ color: '#888' }}>Koszty: </span><span style={{ color: '#e74c3c' }}>{fmt(summaryCost)} PLN</span></div>
                            <div><span style={{ color: '#888' }}>Wynik: </span><span style={{ color: summaryNet >= 0 ? '#2ecc71' : '#e74c3c', fontWeight: 700 }}>{summaryNet >= 0 ? '+' : ''}{fmt(summaryNet)} PLN</span></div>
                        </div>
                        <span style={{ color: '#4a6a4a', fontSize: 18 }}>{plExpanded ? '▲' : '▼'}</span>
                    </div>
                </div>

                {plExpanded && (
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                            {['daily','monthly'].map(v => (
                                <button key={v} onClick={() => setPlView(v)}
                                    style={{ background: plView===v ? '#1a3a1a' : 'rgba(255,255,255,0.04)', border: `1px solid ${plView===v ? '#2ecc71' : '#333'}`, color: plView===v ? '#2ecc71' : '#888', borderRadius: 4, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                                    {v === 'daily' ? 'Dzienny' : 'Miesięczny'}
                                </button>
                            ))}
                        </div>

                        {plView === 'daily' && (
                            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {dailyDocs.length === 0 && <div style={{ color: '#555', fontSize: 12 }}>Brak danych – historia uzupełnia się codziennie o 3:00.</div>}
                                {dailyDocs.map(d => {
                                    const rev = d.revenues || {}
                                    const cost = d.costs || {}
                                    const ot   = d.oneTimeCosts || []
                                    const totalRev  = Object.values(rev).reduce((a,b)=>a+b,0)
                                    const totalCost = Object.values(cost).reduce((a,b)=>a+b,0) + ot.reduce((a,b)=>a+(b.amount||0),0)
                                    const net = totalRev - totalCost
                                    return (
                                        <div key={d.id} style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '10px 12px', border: '1px solid rgba(42,74,42,0.3)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <span style={{ fontSize: 12, color: '#aaa', fontWeight: 700 }}>{d.date}</span>
                                                <span style={{ fontSize: 12, color: net>=0?'#2ecc71':'#e74c3c', fontWeight: 700 }}>{net>=0?'+':''}{fmt(net)} PLN</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                                                <div>
                                                    <div style={{ fontSize: 10, color: '#2ecc71', textTransform: 'uppercase', marginBottom: 3, letterSpacing: 1 }}>Przychody +{fmt(totalRev)}</div>
                                                    {rev.courses         > 0 && <PLRow label="Kursy" value={rev.courses} />}
                                                    {rev.wars            > 0 && <PLRow label="Wars" value={rev.wars} />}
                                                    {rev.fines           > 0 && <PLRow label="Mandaty" value={rev.fines} />}
                                                    {rev.depositInterest > 0 && <PLRow label="Odsetki z lokat" value={rev.depositInterest} color="#2ecc71" />}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: '#e74c3c', textTransform: 'uppercase', marginBottom: 3, letterSpacing: 1 }}>Koszty −{fmt(totalCost)}</div>
                                                    {cost.operational    > 0 && <PLRow label="Operacyjne" value={cost.operational} />}
                                                    {cost.trackFees      > 0 && <PLRow label="Tory" value={cost.trackFees} />}
                                                    {cost.creditInterest > 0 && <PLRow label="Odsetki" value={cost.creditInterest} />}
                                                    {ot.map((o,i) => <PLRow key={i} label={o.desc || o.type} value={o.amount} />)}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {plView === 'monthly' && (
                            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {monthlyDocs.length === 0 && <div style={{ color: '#555', fontSize: 12 }}>Brak danych – podsumowanie miesięczne generowane 1. dnia miesiąca.</div>}
                                {monthlyDocs.map(d => {
                                    const rev  = d.revenues || {}
                                    const cost = d.costs    || {}
                                    return (
                                        <div key={d.id} style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '10px 12px', border: '1px solid rgba(42,74,42,0.3)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <span style={{ fontSize: 12, color: '#aaa', fontWeight: 700 }}>{d.month}</span>
                                                <span style={{ fontSize: 12, color: d.netResult>=0?'#2ecc71':'#e74c3c', fontWeight: 700 }}>{d.netResult>=0?'+':''}{fmt(d.netResult||0)} PLN</span>
                                            </div>
                                            <PLRow label="Przychody łącznie" value={rev.total||0} color="#2ecc71" />
                                            <PLRow label="Koszty łącznie"    value={cost.total||0} color="#e74c3c" />
                                            <PLRow label="Salaria" value={cost.salaries||0} />
                                            <PLRow label="Koszty jednorazowe" value={cost.oneTime||0} />
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}
