import { useMemo, useState } from 'react'
import { useGame } from '../../../../context/GameContext'
import styles from '../../CompanyMenu.module.css'

const fmt = (n) => Math.round(n).toLocaleString('pl-PL')

const PLRow = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
        <span style={{ color: '#999' }}>{label}</span>
        <span style={{ color: color || '#ddd', fontFamily: 'Share Tech Mono, monospace' }}>
            {fmt(value)} PLN
        </span>
    </div>
)

const btnStyle = (active) => ({
    background: active ? '#1a3a1a' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? '#2ecc71' : '#333'}`,
    color: active ? '#2ecc71' : '#888',
    borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
})

const dayTotals = (d) => {
    const rev  = d.revenues || {}
    const cost = d.costs || {}
    const ot   = d.oneTimeCosts || []
    const totalRev  = Object.values(rev).reduce((a, b) => a + b, 0)
    const totalCost = Object.values(cost).reduce((a, b) => a + b, 0) + ot.reduce((a, b) => a + (b.amount || 0), 0)
    return { rev, cost, ot, totalRev, totalCost, net: totalRev - totalCost }
}

export default function FinanceLedger() {
    const { financeLedger = [], gameDate } = useGame()
    const [expanded, setExpanded]       = useState(false)
    const [selectedDay, setSelectedDay] = useState(null)

    const gameYear  = gameDate ? gameDate.getFullYear() : null
    const gameMonth = gameDate ? gameDate.getMonth() + 1 : null

    const dailyDocs = useMemo(() => financeLedger.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id)), [financeLedger])

    const currentMonthPrefix = gameYear && gameMonth
        ? `${gameYear}-${String(gameMonth).padStart(2, '0')}-`
        : null
    const currentMonthDays = useMemo(() =>
        dailyDocs
            .filter(d => currentMonthPrefix && d.id.startsWith(currentMonthPrefix))
            .sort((a, b) => b.id.localeCompare(a.id))
    , [dailyDocs, currentMonthPrefix])

    const activeDayDoc = useMemo(() => {
        if (selectedDay) return currentMonthDays.find(d => d.id === selectedDay) || null
        return currentMonthDays[0] || null
    }, [selectedDay, currentMonthDays])

    // Nagłówek: ostatni dostępny dzień
    const lastDayDoc = currentMonthDays[0] || dailyDocs[0] || null
    const { summaryRev, summaryCost, summaryLabel } = useMemo(() => {
        if (!lastDayDoc) return { summaryRev: 0, summaryCost: 0, summaryLabel: '' }
        const { totalRev, totalCost } = dayTotals(lastDayDoc)
        return { summaryRev: totalRev, summaryCost: totalCost, summaryLabel: lastDayDoc.id }
    }, [lastDayDoc])
    const summaryNet = summaryRev - summaryCost

    return (
        <div className={styles.grid} style={{ marginTop: 8 }}>
            <section className={styles.card} style={{ gridColumn: 'span 2', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>Dziennik Finansowy</h3>
                        {summaryLabel && <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{summaryLabel}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.5 }}>
                            <div><span style={{ color: '#888' }}>Przychody: </span><span style={{ color: '#2ecc71' }}>{fmt(summaryRev)} PLN</span></div>
                            <div><span style={{ color: '#888' }}>Koszty: </span><span style={{ color: '#e74c3c' }}>{fmt(summaryCost)} PLN</span></div>
                            <div><span style={{ color: '#888' }}>Wynik: </span><span style={{ color: summaryNet >= 0 ? '#2ecc71' : '#e74c3c', fontWeight: 700 }}>{summaryNet >= 0 ? '+' : ''}{fmt(summaryNet)} PLN</span></div>
                        </div>
                        <span style={{ color: '#4a6a4a', fontSize: 18 }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                </div>

                {expanded && (
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                            {currentMonthDays.length === 0
                                ? <span style={{ color: '#555', fontSize: 12 }}>Brak danych za bieżący miesiąc.</span>
                                : currentMonthDays.map(d => {
                                    const day    = d.id.slice(8)
                                    const active = (selectedDay || currentMonthDays[0]?.id) === d.id
                                    return (
                                        <button key={d.id} onClick={() => setSelectedDay(d.id)} style={btnStyle(active)}>
                                            {day}
                                        </button>
                                    )
                                })
                            }
                        </div>

                        {activeDayDoc && (() => {
                            const { rev, cost, ot, totalRev, totalCost, net } = dayTotals(activeDayDoc)
                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: '#2ecc71', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                                            Przychody · +{fmt(totalRev)} PLN
                                        </div>
                                        {rev.courses         > 0 && <PLRow label="Kursy pasażerskie" value={rev.courses} />}
                                        {rev.wars            > 0 && <PLRow label="Wars (wagon bar)"  value={rev.wars} />}
                                        {rev.fines           > 0 && <PLRow label="Mandaty kontrolne" value={rev.fines} />}
                                        {rev.depositInterest > 0 && <PLRow label="Odsetki z lokat"   value={rev.depositInterest} color="#2ecc71" />}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: '#e74c3c', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                                            Koszty · −{fmt(totalCost)} PLN
                                        </div>
                                        {cost.operational    > 0 && <PLRow label="Eksploatacja (km)"  value={cost.operational} />}
                                        {cost.trackFees      > 0 && <PLRow label="Opłaty torowe"       value={cost.trackFees} />}
                                        {cost.creditInterest > 0 && <PLRow label="Odsetki kredytowe"   value={cost.creditInterest} />}
                                        {ot.map((o, i) => <PLRow key={i} label={o.desc || o.type} value={o.amount} />)}
                                        <div style={{ borderTop: '1px solid rgba(42,74,42,0.4)', marginTop: 8, paddingTop: 6 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                                                <span style={{ color: '#aaa' }}>Wynik dnia</span>
                                                <span style={{ color: net >= 0 ? '#2ecc71' : '#e74c3c', fontFamily: 'Share Tech Mono, monospace' }}>
                                                    {net >= 0 ? '+' : ''}{fmt(net)} PLN
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                        {!activeDayDoc && <div style={{ color: '#555', fontSize: 12 }}>Brak danych za wybrany dzień.</div>}
                    </div>
                )}
            </section>
        </div>
    )
}
