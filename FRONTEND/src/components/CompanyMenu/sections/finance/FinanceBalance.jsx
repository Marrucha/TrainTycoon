import { useState } from 'react'
import { useGame } from '../../../../context/GameContext'
import styles from '../../CompanyMenu.module.css'

const fmt = (n) => Math.round(n).toLocaleString('pl-PL')

const Row = ({ label, value, bold, dim, indent }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid rgba(42,74,42,0.15)', paddingLeft: indent ? '12px' : 0 }}>
        <span style={{ fontSize: dim ? '11px' : '12px', color: dim ? '#8aab8a' : '#ccc' }}>{label}</span>
        <span style={{ fontSize: bold ? '14px' : '12px', fontWeight: bold ? '700' : '400', color: bold ? '#f0c040' : '#fff', fontFamily: 'Share Tech Mono, monospace' }}>{fmt(value)} PLN</span>
    </div>
)

export default function FinanceBalance({ budget, trains, baseTrains, deposits, playerDoc }) {
    const { gameDate } = useGame()
    const [balanceExpanded, setBalanceExpanded] = useState(false)

    const fleetValue = trains.reduce((sum, t) => {
        const base = baseTrains.find(b => b.id === t.parent_id)
        if (!base) return sum
        const basePrice = base.price || (base.speed || 100) * (base.seats || 50) * 100
        const purchaseDate = t.purchasedAt ? new Date(t.purchasedAt) : gameDate
        const lastOverDate = t.lastOverhaul ? new Date(t.lastOverhaul) : purchaseDate
        const ageYears = (gameDate - lastOverDate) / (1000 * 60 * 60 * 24 * 365)
        const condition = Math.max(0, 100 - (ageYears / 10) * 40) / 100
        return sum + Math.round(basePrice * condition)
    }, 0)

    const cash = budget
    const depositTotal = (deposits || []).reduce((s, d) => s + d.amount, 0)
    const totalAssets = cash + depositTotal + fleetValue

    const loansDebt = (playerDoc.finance?.loans || [])
        .reduce((s, l) => s + Math.round(l.monthlyPayment * l.remainingMonths), 0)
    const creditLineDebt = playerDoc.finance?.creditLine
        ? Math.max(0, playerDoc.finance.creditLine.limit - budget)
        : 0
    const totalLiabilities = loansDebt + creditLineDebt
    const equity = totalAssets - totalLiabilities

    return (
        <div className={styles.grid}>
            <section className={styles.card} style={{ gridColumn: 'span 2', cursor: 'pointer' }} onClick={() => setBalanceExpanded(v => !v)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Bilans</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', color: '#8aab8a', letterSpacing: '1px', fontWeight: 'bold' }}>ŚRODKI OPERACYJNE</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#2ecc71', lineHeight: 1 }}>{fmt(budget)} PLN</div>
                        </div>
                        <span style={{ color: '#4a6a4a', fontSize: '18px' }}>{balanceExpanded ? '▲' : '▼'}</span>
                    </div>
                </div>

                {balanceExpanded && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '20px' }} onClick={e => e.stopPropagation()}>
                        <div>
                            <div style={{ fontSize: '10px', color: '#f0c040', letterSpacing: '3px', marginBottom: '8px', borderBottom: '1px solid #f0c040', paddingBottom: '4px' }}>AKTYWA</div>
                            <div style={{ fontSize: '10px', color: '#8aab8a', letterSpacing: '2px', margin: '8px 0 4px', fontWeight: 'bold' }}>AKTYWA OBROTOWE</div>
                            <Row label="Środki pieniężne" value={cash} indent />
                            <Row label="Lokaty terminowe" value={depositTotal} indent />
                            <div style={{ fontSize: '10px', color: '#8aab8a', letterSpacing: '2px', margin: '10px 0 4px', fontWeight: 'bold' }}>AKTYWA TRWAŁE</div>
                            <Row label="Tabor kolejowy (wartość bilansowa)" value={fleetValue} indent />
                            <div style={{ marginTop: '10px' }}>
                                <Row label="RAZEM AKTYWA" value={totalAssets} bold />
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '10px', color: '#f0c040', letterSpacing: '3px', marginBottom: '8px', borderBottom: '1px solid #f0c040', paddingBottom: '4px' }}>PASYWA</div>
                            <div style={{ fontSize: '10px', color: '#8aab8a', letterSpacing: '2px', margin: '8px 0 4px', fontWeight: 'bold' }}>KAPITAŁ WŁASNY</div>
                            <Row label="Kapitał własny" value={equity} indent />
                            <div style={{ fontSize: '10px', color: '#8aab8a', letterSpacing: '2px', margin: '10px 0 4px', fontWeight: 'bold' }}>ZOBOWIĄZANIA</div>
                            <Row label="Kredyty inwestycyjne" value={loansDebt} indent />
                            <Row label="Linia kredytowa (wykorzystana)" value={creditLineDebt} indent />
                            <div style={{ marginTop: '10px' }}>
                                <Row label="RAZEM PASYWA" value={totalAssets} bold />
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}
