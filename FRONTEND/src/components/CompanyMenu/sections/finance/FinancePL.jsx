import { useMemo, useState } from 'react'
import { useGame } from '../../../../context/GameContext'
import styles from '../../CompanyMenu.module.css'

const OFFICE_RENT      = 2_000_000   // PLN/miesiąc
const MANAGEMENT_COST  = 2_000_000   // PLN/miesiąc
const ENERGY_PRICE_KWH = 0.80        // PLN za kWh
const DEPRECIATION_YRS = 25          // lata amortyzacji liniowej

const fmt = (n) => Math.round(n).toLocaleString('pl-PL')

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Podatek progresywny — naliczany miesięcznie
// 10% do 100M, 15% do 200M, 20% do 500M, 30% powyżej
function calcMonthlyTax(grossProfit) {
    if (grossProfit <= 0) return 0
    const brackets = [
        [100_000_000, 0.10],
        [200_000_000, 0.15],
        [500_000_000, 0.20],
        [Infinity,    0.30],
    ]
    let tax = 0, prev = 0, rem = grossProfit
    for (const [limit, rate] of brackets) {
        const chunk = Math.min(rem, limit - prev)
        tax += chunk * rate
        rem -= chunk
        prev = limit
        if (rem <= 0) break
    }
    return Math.round(tax)
}

const PLRow = ({ label, value, color, bold, indent }) => (
    <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '3px 0',
        fontSize: bold ? 12 : 11,
        borderTop: bold ? '1px solid rgba(42,74,42,0.3)' : 'none',
        marginTop: bold ? 4 : 0,
        paddingLeft: indent ? 12 : 0,
    }}>
        <span style={{ color: bold ? '#ccc' : '#888' }}>{label}</span>
        <span style={{ color: color || (bold ? '#f0c040' : '#ddd'), fontWeight: bold ? 700 : 400, fontFamily: 'Share Tech Mono, monospace' }}>
            {fmt(value)} PLN
        </span>
    </div>
)

const SectionLabel = ({ title, color = '#888' }) => (
    <div style={{ fontSize: 10, color, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 2 }}>
        {title}
    </div>
)

export default function FinancePL() {
    const { financeLedger = [], trainsSets = [], trains = [], cities = [], employees = [], gameConstants } = useGame()
    const [expanded, setExpanded] = useState(false)
    const [view, setView]         = useState('monthly')

    const citiesMap = useMemo(() => {
        const m = {}
        cities.forEach(c => { if (c.id) m[c.id] = c; if (c.name) m[c.name] = c })
        return m
    }, [cities])

    const trainsById = useMemo(() => {
        const m = {}
        trains.forEach(t => { m[t.id] = t })
        return m
    }, [trains])

    // Wynagrodzenia — wyliczane bezpośrednio z listy pracowników
    const monthlySalaries = useMemo(() => {
        const INTERN_SALARY = gameConstants?.INTERN_SALARY ?? 4300
        return employees.reduce((sum, e) => {
            return sum + (e.isIntern ? INTERN_SALARY : (e.monthlySalary || 0))
        }, 0)
    }, [employees, gameConstants])

    // Amortyzacja liniowa: cena / 25 lat / 12 miesięcy
    const monthlyDepreciation = useMemo(() =>
        trains.reduce((sum, t) => {
            const price = t.price || (t.speed || 100) * (t.seats || 50) * 100
            return sum + Math.round(price / DEPRECIATION_YRS / 12)
        }, 0)
    , [trains])

    // Energia: (1000 + 100×extraWagonów) kWh/100km × speedFactor × cena × 30 dni
    const monthlyEnergyCost = useMemo(() => {
        let dailyKwh = 0
        for (const ts of trainsSets) {
            if (!ts.rozklad?.length) continue
            const tsTrains = (ts.trainIds || []).map(id => trainsById[id]).filter(Boolean)
            if (!tsTrains.length) continue

            const maxSpeed    = tsTrains.reduce((max, t) => Math.max(max, t.speed || 100), 100)
            const wagonCount  = tsTrains.filter(t => (t.seats || 0) > 0).length
            const extraWagons = Math.max(0, wagonCount - 1)
            const speedFactor = Math.pow(1.1, (maxSpeed - 100) / 10)
            const energyPer100km = (1000 + 100 * extraWagons) * speedFactor  // kWh

            const byKurs = {}
            ts.rozklad.forEach(s => {
                const k = s.kurs ?? '_'
                if (!byKurs[k]) byKurs[k] = []
                byKurs[k].push(s)
            })
            for (const stops of Object.values(byKurs)) {
                let kursKwh = 0
                for (let i = 0; i < stops.length - 1; i++) {
                    const ca = citiesMap[stops[i].miasto]
                    const cb = citiesMap[stops[i + 1].miasto]
                    if (ca && cb) {
                        kursKwh += (haversineKm(ca.lat, ca.lon, cb.lat, cb.lon) / 100) * energyPer100km
                    }
                }
                // +300 kWh za każdy przystanek poza ostatnim (start + pośrednie)
                const stopCount = Math.max(0, stops.length - 1)
                kursKwh += stopCount * 300
                dailyKwh += kursKwh
            }
        }
        return Math.round(dailyKwh * 30 * ENERGY_PRICE_KWH)
    }, [trainsSets, trainsById, citiesMap])

    const dailyDocs    = financeLedger.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
    const monthlyDocs  = financeLedger.filter(d => d.id?.startsWith('monthly-'))
    const latestMonthly = monthlyDocs[0]

    const baseRev = useMemo(() => {
        if (latestMonthly) return latestMonthly.revenues || {}
        return dailyDocs.reduce((acc, d) => {
            Object.entries(d.revenues || {}).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v })
            return acc
        }, {})
    }, [latestMonthly, dailyDocs])

    const baseCosts = useMemo(() => {
        if (latestMonthly) return latestMonthly.costs || {}
        const result = dailyDocs.reduce((acc, d) => {
            Object.entries(d.costs || {}).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v })
            for (const ot of (d.oneTimeCosts || [])) {
                const amt = ot.amount || 0
                if (ot.type === 'salaries')         acc.salaries     = (acc.salaries     || 0) + amt
                else if (ot.type === 'loanPayment') acc.loanPayments = (acc.loanPayments || 0) + amt
                else if (ot.type === 'ceoSalary')   acc.ceoSalary    = (acc.ceoSalary    || 0) + amt
                else                               acc.oneTime      = (acc.oneTime      || 0) + amt
            }
            return acc
        }, {})
        return result
    }, [latestMonthly, dailyDocs])

    const estimatedCeoSalary = useMemo(() => {
        if (latestMonthly) {
            if (latestMonthly.costs?.ceoSalary) return latestMonthly.costs.ceoSalary
        }
        let lastNetResult = 0
        if (financeLedger) {
            const monthlyDocs = financeLedger.filter(d => d.id?.startsWith('monthly-'))
            if (monthlyDocs.length > 0) {
                lastNetResult = monthlyDocs[0].netResult || 0
            }
        }
        const bonus = lastNetResult > 0 ? lastNetResult * 0.001 : 0
        return Math.round(30000 + bonus)
    }, [latestMonthly, financeLedger])

    const monthly = useMemo(() => {
        const rev = {
            courses:         baseRev.courses         || 0,
            wars:            baseRev.wars            || 0,
            fines:           baseRev.fines           || 0,
            depositInterest: baseRev.depositInterest || 0,
        }
        rev.total = rev.courses + rev.wars + rev.fines + rev.depositInterest

        const costs = {
            operational:    baseCosts.operational    || 0,
            energy:         baseCosts.energy || monthlyEnergyCost,
            trackFees:      baseCosts.trackFees      || 0,
            salaries:       monthlySalaries,
            office:         OFFICE_RENT,
            management:     MANAGEMENT_COST + (baseCosts.ceoSalary || estimatedCeoSalary),
            depreciation:   monthlyDepreciation,
            creditInterest: baseCosts.creditInterest || 0,
            loanPayments:   baseCosts.loanPayments   || 0,
            oneTime:        baseCosts.oneTime        || 0,
        }
        costs.total = Object.values(costs).reduce((s, v) => s + v, 0)

        const grossProfit = rev.total - costs.total
        const tax         = calcMonthlyTax(grossProfit)
        const netProfit   = grossProfit - tax
        return { rev, costs, grossProfit, tax, netProfit }
    }, [baseRev, baseCosts, monthlyEnergyCost, monthlyDepreciation])

    // Widok roczny: × 12, podatek też × 12 (naliczany miesięcznie)
    const mult = view === 'annual' ? 12 : 1
    const R = (k) => monthly.rev[k]   * mult
    const C = (k) => monthly.costs[k] * mult
    const totalRev  = monthly.rev.total   * mult
    const totalCost = monthly.costs.total * mult
    const gross     = monthly.grossProfit * mult
    const tax       = monthly.tax         * mult
    const net       = monthly.netProfit   * mult

    const netColor = net >= 0 ? '#2ecc71' : '#e74c3c'

    return (
        <div className={styles.grid} style={{ marginTop: 8 }}>
            <section className={styles.card} style={{ gridColumn: 'span 2', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Rachunek Zysków i Strat</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.6 }}>
                            <div><span style={{ color: '#888' }}>Przychody: </span><span style={{ color: '#2ecc71' }}>{fmt(totalRev)} PLN</span></div>
                            <div><span style={{ color: '#888' }}>Koszty: </span><span style={{ color: '#e74c3c' }}>{fmt(totalCost)} PLN</span></div>
                            <div><span style={{ color: '#888' }}>Wynik netto: </span><span style={{ color: netColor, fontWeight: 700 }}>{net >= 0 ? '+' : ''}{fmt(net)} PLN</span></div>
                        </div>
                        <span style={{ color: '#4a6a4a', fontSize: 18 }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                </div>

                {expanded && (
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                            {[['monthly', 'Miesięczny'], ['annual', 'Roczny (proj.)']].map(([v, label]) => (
                                <button key={v} onClick={() => setView(v)} style={{
                                    background: view === v ? '#1a3a1a' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${view === v ? '#2ecc71' : '#333'}`,
                                    color: view === v ? '#2ecc71' : '#888',
                                    borderRadius: 4, padding: '4px 12px', fontSize: 11, cursor: 'pointer'
                                }}>{label}</button>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
                            {/* PRZYCHODY */}
                            <div>
                                <SectionLabel title="Przychody" color="#2ecc71" />
                                {R('courses')         > 0 && <PLRow label="Kursy pasażerskie"  value={R('courses')}         indent />}
                                {R('wars')            > 0 && <PLRow label="Wars (wagon bar)"   value={R('wars')}            indent />}
                                {R('fines')           > 0 && <PLRow label="Mandaty kontrolne"  value={R('fines')}           indent />}
                                {R('depositInterest') > 0 && <PLRow label="Odsetki z lokat"    value={R('depositInterest')} indent />}
                                <PLRow label="RAZEM PRZYCHODY" value={totalRev} bold color="#2ecc71" />
                            </div>

                            {/* KOSZTY */}
                            <div>
                                <SectionLabel title="Koszty operacyjne" color="#e74c3c" />
                                {C('operational') > 0 && <PLRow label="Eksploatacja (km)"    value={C('operational')}    indent />}
                                {C('energy')      > 0 && <PLRow label="Energia elektryczna"  value={C('energy')}         indent />}
                                {C('trackFees')   > 0 && <PLRow label="Opłaty torowe"        value={C('trackFees')}      indent />}
                                {C('salaries')    > 0 && <PLRow label="Wynagrodzenia"         value={C('salaries')}       indent />}

                                <SectionLabel title="Koszty stałe" color="#e74c3c" />
                                <PLRow label="Wynajem biur"   value={C('office')}      indent />
                                <PLRow label="Koszty zarządu (w tym pensja CEO)" value={C('management')}  indent />

                                <SectionLabel title="Amortyzacja" color="#e74c3c" />
                                <PLRow label="Amortyzacja taboru" value={C('depreciation')} indent />

                                <SectionLabel title="Koszty finansowe" color="#e74c3c" />
                                {C('creditInterest') > 0 && <PLRow label="Odsetki kredytowe" value={C('creditInterest')} indent />}
                                {C('loanPayments')   > 0 && <PLRow label="Spłaty rat"        value={C('loanPayments')}   indent />}

                                {C('oneTime') > 0 && <>
                                    <SectionLabel title="Jednorazowe" color="#e74c3c" />
                                    <PLRow label="Koszty jednorazowe" value={C('oneTime')} indent />
                                </>}

                                <PLRow label="RAZEM KOSZTY" value={totalCost} bold color="#e74c3c" />
                            </div>
                        </div>

                        {/* WYNIK */}
                        <div style={{ borderTop: '1px solid rgba(42,74,42,0.5)', marginTop: 12, paddingTop: 10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
                                <div>
                                    <PLRow label="WYNIK BRUTTO"     value={gross} bold color={gross >= 0 ? '#f0c040' : '#e74c3c'} />
                                    <PLRow label="Podatek dochodowy" value={-tax}  indent color="#e74c3c" />
                                    <PLRow label="WYNIK NETTO"       value={net}   bold color={netColor} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                                    <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                                        <div>Podatek: 10% (0–100M) · 15% (100–200M) · 20% (200–500M) · 30% (&gt;500M)</div>
                                        <div>Energia: {ENERGY_PRICE_KWH.toFixed(2)} PLN/kWh · Amortyzacja liniowa {DEPRECIATION_YRS} lat</div>
                                        <div style={{ color: '#444', marginTop: 2 }}>
                                            {latestMonthly ? `Dane za: ${latestMonthly.month}` : 'Szacunek z danych dziennych (brak zamkniętego miesiąca)'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}
