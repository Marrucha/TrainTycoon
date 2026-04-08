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

export default function FinanceLedger() {
    const { financeLedger = [], gameDate } = useGame()
    const [expanded, setExpanded]   = useState(false)
    const [view, setView]           = useState('daily')
    const [selectedDay, setSelectedDay]     = useState(null)
    const [selectedMonth, setSelectedMonth] = useState(null)

    const gameYear  = gameDate ? gameDate.getFullYear() : null
    const gameMonth = gameDate ? gameDate.getMonth() + 1 : null  // 1-based
    const gameDay   = gameDate ? gameDate.getDate() : null

    const dailyDocs   = useMemo(() => financeLedger.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id)), [financeLedger])
    const monthlyDocs = useMemo(() => financeLedger.filter(d => d.id?.startsWith('monthly-')), [financeLedger])

    // Dni bieżącego miesiąca gry dostępne w ledgerze
    const currentMonthPrefix = gameYear && gameMonth
        ? `${gameYear}-${String(gameMonth).padStart(2, '0')}-`
        : null
    const currentMonthDays = useMemo(() =>
        dailyDocs
            .filter(d => currentMonthPrefix && d.id.startsWith(currentMonthPrefix))
            .sort((a, b) => b.id.localeCompare(a.id))
    , [dailyDocs, currentMonthPrefix])

    // Miesiące bieżącego roku gry dostępne w ledgerze
    const currentYearPrefix = gameYear ? `monthly-${gameYear}-` : null
    const currentYearMonths = useMemo(() =>
        monthlyDocs
            .filter(d => currentYearPrefix && d.id.startsWith(currentYearPrefix))
            .sort((a, b) => b.id.localeCompare(a.id))
    , [monthlyDocs, currentYearPrefix])

    // Wybrany dzień (domyślnie ostatni dostępny)
    const activeDayDoc = useMemo(() => {
        if (selectedDay) return currentMonthDays.find(d => d.id === selectedDay) || null
        return currentMonthDays[0] || null
    }, [selectedDay, currentMonthDays])

    // Wybrany miesiąc (domyślnie ostatni dostępny)
    const activeMonthDoc = useMemo(() => {
        if (selectedMonth) return currentYearMonths.find(d => d.id === selectedMonth) || null
        return currentYearMonths[0] || null
    }, [selectedMonth, currentYearMonths])

    // Podsumowanie nagłówka (ostatni dostępny miesięczny lub suma dziennych)
    const { summaryRev, summaryCost } = useMemo(() => {
        const latest = monthlyDocs[0]
        if (latest) return { summaryRev: latest.revenues?.total ?? 0, summaryCost: latest.costs?.total ?? 0 }
        const sRev  = dailyDocs.reduce((s, d) => s + Object.values(d.revenues || {}).reduce((a, b) => a + b, 0), 0)
        const sCost = dailyDocs.reduce((s, d) => {
            const c  = Object.values(d.costs || {}).reduce((a, b) => a + b, 0)
            const ot = (d.oneTimeCosts || []).reduce((a, b) => a + (b.amount || 0), 0)
            return s + c + ot
        }, 0)
        return { summaryRev: sRev, summaryCost: sCost }
    }, [dailyDocs, monthlyDocs])
    const summaryNet = summaryRev - summaryCost

    const dayTotals = (d) => {
        if (!d) return { rev: {}, cost: {}, ot: [], totalRev: 0, totalCost: 0, net: 0 }
        const rev  = d.revenues || {}
        const cost = d.costs || {}
        const ot   = d.oneTimeCosts || []
        const totalRev  = Object.values(rev).reduce((a, b) => a + b, 0)
        const totalCost = Object.values(cost).reduce((a, b) => a + b, 0) + ot.reduce((a, b) => a + (b.amount || 0), 0)
        return { rev, cost, ot, totalRev, totalCost, net: totalRev - totalCost }
    }

    return (
        <div className={styles.grid} style={{ marginTop: 8 }}>
            <section className={styles.card} style={{ gridColumn: 'span 2', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Dziennik Finansowy</h3>
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
                        {/* Przełącznik widoku */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                            <button style={btnStyle(view === 'daily')}   onClick={() => setView('daily')}>Dzienny</button>
                            <button style={btnStyle(view === 'monthly')} onClick={() => setView('monthly')}>Miesięczny</button>
                        </div>

                        {/* WIDOK DZIENNY */}
                        {view === 'daily' && (
                            <div>
                                {/* Wybór dnia */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                                    {currentMonthDays.length === 0
                                        ? <span style={{ color: '#555', fontSize: 12 }}>Brak danych za bieżący miesiąc.</span>
                                        : currentMonthDays.map(d => {
                                            const day = d.id.slice(8)  // "DD"
                                            const active = (selectedDay || currentMonthDays[0]?.id) === d.id
                                            return (
                                                <button key={d.id} onClick={() => setSelectedDay(d.id)} style={btnStyle(active)}>
                                                    {day}
                                                </button>
                                            )
                                        })
                                    }
                                </div>

                                {/* Szczegóły wybranego dnia */}
                                {activeDayDoc && (() => {
                                    const { rev, cost, ot, totalRev, totalCost, net } = dayTotals(activeDayDoc)
                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                            {/* Przychody */}
                                            <div>
                                                <div style={{ fontSize: 10, color: '#2ecc71', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                                                    Przychody · +{fmt(totalRev)} PLN
                                                </div>
                                                {rev.courses         > 0 && <PLRow label="Kursy pasażerskie"  value={rev.courses} />}
                                                {rev.wars            > 0 && <PLRow label="Wars (wagon bar)"   value={rev.wars} />}
                                                {rev.fines           > 0 && <PLRow label="Mandaty kontrolne"  value={rev.fines} />}
                                                {rev.depositInterest > 0 && <PLRow label="Odsetki z lokat"    value={rev.depositInterest} color="#2ecc71" />}
                                            </div>

                                            {/* Koszty + podsumowanie */}
                                            <div>
                                                <div style={{ fontSize: 10, color: '#e74c3c', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                                                    Koszty · −{fmt(totalCost)} PLN
                                                </div>
                                                {cost.operational    > 0 && <PLRow label="Eksploatacja (km)"   value={cost.operational} />}
                                                {cost.trackFees      > 0 && <PLRow label="Opłaty torowe"        value={cost.trackFees} />}
                                                {cost.creditInterest > 0 && <PLRow label="Odsetki kredytowe"    value={cost.creditInterest} />}
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

                        {/* WIDOK MIESIĘCZNY */}
                        {view === 'monthly' && (
                            <div>
                                {/* Wybór miesiąca */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                                    {currentYearMonths.length === 0
                                        ? <span style={{ color: '#555', fontSize: 12 }}>Brak zamkniętych miesięcy w bieżącym roku.</span>
                                        : currentYearMonths.map(d => {
                                            const month = d.id.slice(-2)  // "MM"
                                            const active = (selectedMonth || currentYearMonths[0]?.id) === d.id
                                            const monthNames = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
                                            return (
                                                <button key={d.id} onClick={() => setSelectedMonth(d.id)} style={btnStyle(active)}>
                                                    {monthNames[parseInt(month, 10) - 1]}
                                                </button>
                                            )
                                        })
                                    }
                                </div>

                                {/* Szczegóły wybranego miesiąca */}
                                {activeMonthDoc && (() => {
                                    const rev  = activeMonthDoc.revenues || {}
                                    const cost = activeMonthDoc.costs    || {}
                                    const net  = activeMonthDoc.netResult || 0
                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                            <div>
                                                <div style={{ fontSize: 10, color: '#2ecc71', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                                                    Przychody · +{fmt(rev.total || 0)} PLN
                                                </div>
                                                {(rev.courses         || 0) > 0 && <PLRow label="Kursy pasażerskie"  value={rev.courses} />}
                                                {(rev.wars            || 0) > 0 && <PLRow label="Wars (wagon bar)"   value={rev.wars} />}
                                                {(rev.fines           || 0) > 0 && <PLRow label="Mandaty kontrolne"  value={rev.fines} />}
                                                {(rev.depositInterest || 0) > 0 && <PLRow label="Odsetki z lokat"    value={rev.depositInterest} color="#2ecc71" />}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 10, color: '#e74c3c', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                                                    Koszty · −{fmt(cost.total || 0)} PLN
                                                </div>
                                                {(cost.operational    || 0) > 0 && <PLRow label="Eksploatacja (km)"  value={cost.operational} />}
                                                {(cost.trackFees      || 0) > 0 && <PLRow label="Opłaty torowe"       value={cost.trackFees} />}
                                                {(cost.creditInterest || 0) > 0 && <PLRow label="Odsetki kredytowe"   value={cost.creditInterest} />}
                                                {(cost.salaries       || 0) > 0 && <PLRow label="Wynagrodzenia"       value={cost.salaries} />}
                                                {(cost.loanPayments   || 0) > 0 && <PLRow label="Spłaty rat"          value={cost.loanPayments} />}
                                                {(cost.oneTime        || 0) > 0 && <PLRow label="Jednorazowe"         value={cost.oneTime} />}

                                                <div style={{ borderTop: '1px solid rgba(42,74,42,0.4)', marginTop: 8, paddingTop: 6 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                                                        <span style={{ color: '#aaa' }}>Wynik miesiąca</span>
                                                        <span style={{ color: net >= 0 ? '#2ecc71' : '#e74c3c', fontFamily: 'Share Tech Mono, monospace' }}>
                                                            {net >= 0 ? '+' : ''}{fmt(net)} PLN
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                                {!activeMonthDoc && currentYearMonths.length > 0 && <div style={{ color: '#555', fontSize: 12 }}>Brak danych za wybrany miesiąc.</div>}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}
