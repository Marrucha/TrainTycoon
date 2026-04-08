import { useState } from 'react'
import { useGame } from '../../../../context/GameContext'
import { DEPOSIT_TYPES } from '../../../../context/hooks/useFinanceActions'
import styles from '../../CompanyMenu.module.css'

const fmt = (n) => Math.round(n).toLocaleString('pl-PL')

export default function FinanceDeposits({ deposits, depositRates, openDeposit, redeemDeposit, breakDeposit }) {
    const { gameDate } = useGame()
    const [depositAmount, setDepositAmount] = useState('')

    const totalBlocked = (deposits || []).reduce((s, d) => s + d.amount, 0)

    const handleOpen = async (typeKey) => {
        const amount = parseInt(depositAmount, 10)
        const ok = await openDeposit(amount, typeKey, depositRates)
        if (ok) setDepositAmount('')
    }

    return (
        <section className={styles.card}>
            <h3>Depozyty i Lokaty</h3>

            <div style={{ background: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42,74,42,0.4)', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Nowa Lokata</div>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center' }}>
                    <input
                        type="number"
                        min="0"
                        placeholder="Kwota (PLN)"
                        value={depositAmount}
                        onChange={e => setDepositAmount(e.target.value)}
                        className={styles.financeInput}
                    />
                    {[1, 5, 10, 50].map(m => (
                        <button key={m} onClick={() => setDepositAmount(String(m * 1000000))}
                            style={{
                                background: 'rgba(74, 170, 74, 0.15)',
                                border: '1px solid #4a6a4a',
                                color: '#f0c040',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                                fontWeight: 'bold'
                            }}
                            className={styles.financeTypeBtn}
                        >
                            {m}M
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {DEPOSIT_TYPES.map(type => {
                        const annualRate = depositRates?.[type.key] ?? type.defaultRate
                        const periodRate = (type.days / 365) * annualRate
                        const amount = parseInt(depositAmount, 10) || 0
                        const interest = amount > 0 ? Math.round(amount * periodRate) : null
                        return (
                            <button
                                key={type.key}
                                onClick={() => amount > 0 ? handleOpen(type.key) : alert('Podaj kwotę lokaty!')}
                                className={styles.financeTypeBtn}
                            >
                                <span style={{ color: amount <= 0 ? '#b09030' : '#f0c040', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>{type.label}</span>
                                <span style={{ color: '#8aab8a', fontSize: '9px', fontWeight: '600' }}>Okres: {type.days} {type.days === 1 ? 'd' : 'dni'}</span>
                                <span style={{ color: amount <= 0 ? '#5a7a5a' : '#2ecc71', fontSize: '12px', fontWeight: '800', fontFamily: 'Share Tech Mono, monospace' }}>Zysk: +{(periodRate * 100).toFixed(2)}%</span>
                                <span style={{ color: '#8aab8a', fontSize: '9px', fontWeight: '600' }}>Rocznie: {(annualRate * 100).toFixed(1)}% p.a.</span>
                                {interest !== null && amount > 0 && <span style={{ color: '#f0c040', fontSize: '13px', fontWeight: '800', marginTop: '4px' }}>+{fmt(interest)} PLN</span>}
                            </button>
                        )
                    })}
                </div>
            </div>

            {deposits?.length > 0 && (
                <div>
                    <div style={{ fontSize: '11px', color: '#a0c0a0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: '800' }}>Aktywne Lokaty</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {deposits.map((dep, idx) => {
                            const matureDate = new Date(dep.matureAt)
                            const isMatured = matureDate <= gameDate
                            const interest = Math.round(dep.amount * dep.rate)
                            const annualLabel = dep.annualRate != null ? ` (${(dep.annualRate * 100).toFixed(1)}% p.a.)` : ''
                            return (
                                <div key={dep.id || idx} style={{
                                    background: 'rgba(18, 38, 18, 0.85)',
                                    backdropFilter: 'blur(2px)',
                                    WebkitBackdropFilter: 'blur(2px)',
                                    border: `1px solid rgba(46, 204, 113, 0.35)`,
                                    borderLeft: isMatured ? '5px solid #2ecc71' : '5px solid #f0c040',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    boxShadow: isMatured ? '0 0 25px rgba(46,204,113,0.15)' : '0 4px 15px rgba(0,0,0,0.4)',
                                    marginBottom: '8px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#fff', fontFamily: 'Share Tech Mono, monospace' }}>{fmt(dep.amount)} PLN</span>
                                        <span style={{ fontSize: '11px', color: isMatured ? '#2ecc71' : '#f0c040', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            {isMatured ? '✓ DOJRZAŁA' : (dep.label ?? dep.type)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <span style={{ fontSize: '10px', color: '#8aab8a' }}>
                                                Zakończenie: {matureDate.toLocaleDateString('pl-PL')} {matureDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 'bold' }}>
                                                +{fmt(interest)} PLN <span style={{ fontWeight: '400', fontSize: '10px', opacity: 0.8 }}>(+{(dep.rate * 100).toFixed(2)}%{annualLabel})</span>
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => isMatured
                                                ? redeemDeposit(dep.id, dep.amount, dep.rate)
                                                : breakDeposit(dep.id, dep.amount)
                                            }
                                            className={styles.breakBtn}
                                            style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 'bold' }}
                                            title={isMatured ? 'Odbierz lokatę z odsetkami.' : 'Uwaga: zerwanie lokaty przed terminem powoduje utratę wszystkich odsetek — odzyskasz tylko wpłacony kapitał.'}>
                                            Zakończ
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '6px 0', borderTop: '1px solid rgba(42,74,42,0.3)' }}>
                <span style={{ fontSize: '11px', color: '#a0c0a0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Środki Zablokowane:</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: totalBlocked > 0 ? '#f0c040' : '#444' }}>{fmt(totalBlocked)} PLN</span>
            </div>
        </section>
    )
}
