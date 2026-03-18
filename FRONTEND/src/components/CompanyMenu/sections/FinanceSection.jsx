import React, { useState } from 'react';
import styles from '../CompanyMenu.module.css';
import { DEPOSIT_TYPES } from '../../../context/hooks/useFinanceActions';

const fmt = (n) => Math.round(n).toLocaleString('pl-PL');

const FinanceSection = ({
    budget,
    reputation,
    playerDoc,
    trains = [],
    baseTrains = [],
    openCreditLine,
    takeLoan,
    toggleGroup,
    expandedGroups,
    deposits,
    depositRates,
    openDeposit,
    breakDeposit,
    emitShares,
}) => {
    const [depositAmount, setDepositAmount] = useState('');
    const [balanceExpanded, setBalanceExpanded] = useState(false);

    const handleOpen = async (typeKey) => {
        const amount = parseInt(depositAmount, 10);
        const ok = await openDeposit(amount, typeKey, depositRates);
        if (ok) setDepositAmount('');
    };

    const totalBlocked = (deposits || []).reduce((s, d) => s + d.amount, 0);

    return (
        <>
            <div className={styles.sectionHeader}>
                <h2>Finanse</h2>
                <p>Analizuj przepływy pieniężne i rentowność połączeń.</p>
            </div>
            {(() => {
                // ── Wycena taboru ──
                const fleetValue = trains.reduce((sum, t) => {
                    const base = baseTrains.find(b => b.id === t.parent_id)
                    if (!base) return sum
                    const basePrice = base.price || (base.speed || 100) * (base.seats || 50) * 100
                    const purchaseDate = t.purchasedAt ? new Date(t.purchasedAt) : new Date()
                    const lastOverDate = t.lastOverhaul ? new Date(t.lastOverhaul) : purchaseDate
                    const ageYears = (new Date() - lastOverDate) / (1000 * 60 * 60 * 24 * 365)
                    const condition = Math.max(0, 100 - (ageYears / 10) * 40) / 100
                    return sum + Math.round(basePrice * condition)
                }, 0)

                // ── Aktywa ──
                const cash = budget
                const depositTotal = (deposits || []).reduce((s, d) => s + d.amount, 0)
                const totalAssets = cash + depositTotal + fleetValue

                // ── Pasywa ──
                const loansDebt = (playerDoc.finance?.loans || [])
                    .reduce((s, l) => s + Math.round(l.monthlyPayment * l.remainingMonths), 0)
                const creditLineDebt = playerDoc.finance?.creditLine
                    ? Math.max(0, playerDoc.finance.creditLine.limit - budget)
                    : 0
                const totalLiabilities = loansDebt + creditLineDebt
                const equity = totalAssets - totalLiabilities

                const Row = ({ label, value, bold, dim, indent }) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid rgba(42,74,42,0.15)', paddingLeft: indent ? '12px' : 0 }}>
                        <span style={{ fontSize: dim ? '10px' : '11px', color: dim ? '#4a6a4a' : '#aaa' }}>{label}</span>
                        <span style={{ fontSize: bold ? '13px' : '11px', fontWeight: bold ? '700' : '400', color: bold ? '#fff' : '#ccc', fontFamily: 'Share Tech Mono, monospace' }}>{fmt(value)} PLN</span>
                    </div>
                )

                return (
                    <div className={styles.grid}>
                        <section className={styles.card} style={{ gridColumn: 'span 2', cursor: 'pointer' }} onClick={() => setBalanceExpanded(v => !v)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>Bilans</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', color: '#4a6a4a', letterSpacing: '1px' }}>ŚRODKI OPERACYJNE</div>
                                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#2ecc71', lineHeight: 1 }}>{fmt(budget)} PLN</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', color: '#4a6a4a', letterSpacing: '1px' }}>TRUST-SCORE</div>
                                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1c40f', lineHeight: 1 }}>{(reputation * 100).toFixed(1)}%</div>
                                    </div>
                                    <span style={{ color: '#4a6a4a', fontSize: '18px' }}>{balanceExpanded ? '▲' : '▼'}</span>
                                </div>
                            </div>

                            {balanceExpanded && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '20px' }} onClick={e => e.stopPropagation()}>
                                    {/* AKTYWA */}
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#f0c040', letterSpacing: '3px', marginBottom: '8px', borderBottom: '1px solid #f0c040', paddingBottom: '4px' }}>AKTYWA</div>
                                        <div style={{ fontSize: '10px', color: '#4a6a4a', letterSpacing: '2px', margin: '8px 0 4px' }}>AKTYWA OBROTOWE</div>
                                        <Row label="Środki pieniężne" value={cash} indent />
                                        <Row label="Lokaty terminowe" value={depositTotal} indent />
                                        <div style={{ fontSize: '10px', color: '#4a6a4a', letterSpacing: '2px', margin: '10px 0 4px' }}>AKTYWA TRWAŁE</div>
                                        <Row label="Tabor kolejowy (wartość bilansowa)" value={fleetValue} indent />
                                        <div style={{ marginTop: '10px' }}>
                                            <Row label="RAZEM AKTYWA" value={totalAssets} bold />
                                        </div>
                                    </div>

                                    {/* PASYWA */}
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#f0c040', letterSpacing: '3px', marginBottom: '8px', borderBottom: '1px solid #f0c040', paddingBottom: '4px' }}>PASYWA</div>
                                        <div style={{ fontSize: '10px', color: '#4a6a4a', letterSpacing: '2px', margin: '8px 0 4px' }}>KAPITAŁ WŁASNY</div>
                                        <Row label="Kapitał własny" value={equity} indent />
                                        <div style={{ fontSize: '10px', color: '#4a6a4a', letterSpacing: '2px', margin: '10px 0 4px' }}>ZOBOWIĄZANIA</div>
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
            })()}

            <div className={styles.sectionHeader} style={{ marginTop: '30px' }}>
                <h2>Sektor Bankowy</h2>
                <p>Zarządzaj kredytami, lokatami i akcjami swojej firmy.</p>
            </div>

            <div className={styles.grid}>
                {/* Kredyty */}
                <section className={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3>Instrumenty Dłużne</h3>
                        <span style={{ fontSize: '12px', color: '#666' }}>Zdolność: 500.000.000 PLN</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>Linia Kredytowa (100 mln)</span>
                                <span style={{ fontSize: '13px', color: '#888' }}>6% rocznie</span>
                            </div>
                            {playerDoc.finance?.creditLine ? (() => {
                                const cl = playerDoc.finance.creditLine;
                                const used = Math.max(0, cl.limit - budget);
                                const monthlyCommitment = Math.round(cl.limit * (cl.commitmentRate ?? 0.01) / 12);
                                const dailyInterest = Math.round(used * (cl.annualRate ?? 0.06) / 365);
                                return (
                                    <div style={{ padding: '8px', background: 'rgba(46,204,113,0.1)', borderRadius: '4px', border: '1px solid #2ecc71', fontSize: '11px', color: '#2ecc71', display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
                                );
                            })() : (
                                <button className={styles.saveBtn} style={{ width: '100%', padding: '8px', fontSize: '11px', margin: '5px 0 0 0' }} onClick={() => openCreditLine(100000000)}>
                                    Otwórz Linię
                                </button>
                            )}
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>Kredyty Inwestycyjne</span>
                                <span style={{ fontSize: '11px', color: '#888' }}>Spłata: 24 m-ce</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {[
                                    { amt: 20000000,  label: '20 mln',  rate: '5.0%' },
                                    { amt: 50000000,  label: '50 mln',  rate: '5.2%' },
                                    { amt: 100000000, label: '100 mln', rate: '5.4%' },
                                    { amt: 200000000, label: '200 mln', rate: '5.6%' },
                                ].map(loan => (
                                    <button key={loan.amt} className={styles.saveBtn}
                                        style={{ padding: '6px', fontSize: '10px', margin: 0, background: '#e67e22', display: 'flex', flexDirection: 'column', height: 'auto', alignItems: 'center' }}
                                        onClick={() => takeLoan(loan.amt, 24)}>
                                        <span style={{ fontWeight: '800' }}>{loan.label}</span>
                                        <span style={{ opacity: 0.8, fontSize: '9px' }}>Koszt: {loan.rate}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {playerDoc.finance?.loans?.length > 0 && (
                            <div style={{ marginTop: '10px' }}>
                                <h4 style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Aktywne Kredyty</h4>
                                {playerDoc.finance.loans.map(loan => (
                                    <div key={loan.id} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '6px', marginBottom: '6px', overflow: 'hidden', border: '1px solid rgba(243,156,18,0.2)' }}>
                                        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                            onClick={() => toggleGroup(`loan-${loan.id}`)}>
                                            <span style={{ fontSize: '12px', fontWeight: '700' }}>Kredyt #{loan.id.slice(-4)}</span>
                                            <span style={{ fontSize: '12px', color: '#f39c12' }}>Pozostało: {loan.remainingMonths} m-cy</span>
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

                {/* Lokaty */}
                <section className={styles.card}>
                    <h3>Depozyty i Lokaty</h3>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42,74,42,0.3)', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Nowa Lokata</div>

                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center' }}>
                            <input
                                type="number"
                                min="0"
                                placeholder="Kwota (PLN)"
                                value={depositAmount}
                                onChange={e => setDepositAmount(e.target.value)}
                                style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid #2a4a2a', color: '#fff', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                            />
                            {[1, 5, 10, 50].map(m => (
                                <button key={m} onClick={() => setDepositAmount(String(m * 1000000))}
                                    style={{ background: 'rgba(42,74,42,0.4)', border: '1px solid #2a4a2a', color: '#8aab8a', padding: '4px 7px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {m}M
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            {DEPOSIT_TYPES.map(type => {
                                const annualRate = depositRates?.[type.key] ?? type.defaultRate;
                                const periodRate = (type.days / 365) * annualRate;
                                const amount = parseInt(depositAmount, 10) || 0;
                                const interest = amount > 0 ? Math.round(amount * periodRate) : null;
                                const disabled = !depositAmount || parseInt(depositAmount) <= 0;
                                return (
                                    <button key={type.key} onClick={() => handleOpen(type.key)} disabled={disabled}
                                        style={{ background: 'rgba(39,174,96,0.15)', border: '1px solid rgba(39,174,96,0.3)', borderRadius: '6px', padding: '8px 6px', cursor: disabled ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', opacity: disabled ? 0.5 : 1 }}>
                                        <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700' }}>{type.label}</span>
                                        <span style={{ color: '#8aab8a', fontSize: '10px' }}>{type.days} {type.days === 1 ? 'dzień' : 'dni'}</span>
                                        <span style={{ color: '#2ecc71', fontSize: '12px', fontWeight: '700' }}>+{(periodRate * 100).toFixed(2)}%</span>
                                        <span style={{ color: '#4a6a4a', fontSize: '9px' }}>{(annualRate * 100).toFixed(1)}% p.a.</span>
                                        {interest !== null && <span style={{ color: '#f0c040', fontSize: '10px' }}>+{fmt(interest)} PLN</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {deposits?.length > 0 && (
                        <div>
                            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Aktywne Lokaty</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {deposits.map(dep => {
                                    const matureDate = new Date(dep.matureAt);
                                    const isMatured = matureDate <= new Date();
                                    const interest = Math.round(dep.amount * dep.rate);
                                    const annualLabel = dep.annualRate != null ? ` (${(dep.annualRate * 100).toFixed(1)}% p.a.)` : '';
                                    return (
                                        <div key={dep.id} style={{ background: isMatured ? 'rgba(39,174,96,0.1)' : 'rgba(0,0,0,0.2)', border: `1px solid ${isMatured ? '#27ae60' : 'rgba(42,74,42,0.3)'}`, borderRadius: '6px', padding: '8px 10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{fmt(dep.amount)} PLN</span>
                                                <span style={{ fontSize: '11px', color: isMatured ? '#27ae60' : '#f0c040', fontWeight: '700' }}>
                                                    {isMatured ? '✓ DOJRZAŁA' : (dep.label ?? dep.type)}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '10px', color: '#888' }}>
                                                        Zakończenie: {matureDate.toLocaleDateString('pl-PL')} {matureDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span style={{ fontSize: '10px', color: '#2ecc71' }}>
                                                        +{fmt(interest)} PLN ({(dep.rate * 100).toFixed(2)}%{annualLabel})
                                                    </span>
                                                </div>
                                                <button onClick={() => breakDeposit(dep.id, dep.amount)}
                                                    style={{ background: 'rgba(231,76,60,0.2)', border: '1px solid rgba(231,76,60,0.4)', color: '#e74c3c', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                    title="Uwaga: zerwanie lokaty przed terminem powoduje utratę wszystkich odsetek — odzyskasz tylko wpłacony kapitał.">
                                                    Zakończ
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '6px 0', borderTop: '1px solid rgba(42,74,42,0.3)' }}>
                        <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>Środki Zablokowane:</span>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: totalBlocked > 0 ? '#f0c040' : '#444' }}>{fmt(totalBlocked)} PLN</span>
                    </div>
                </section>

                {/* Giełda */}
                <section className={styles.card} style={{ gridColumn: 'span 2' }}>
                    {(() => {
                        const co = playerDoc.company ?? { totalShares: 1000000, playerShares: 1000000, stockPrice: 100, freeFloat: 0, shareholders: [], emissions: [] };
                        const { totalShares, playerShares, stockPrice, freeFloat = 0, shareholders, emissions } = co;
                        const playerPct = (playerShares / totalShares * 100).toFixed(2);
                        const marketCap = totalShares * stockPrice;

                        return (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                    <div>
                                        <h3 style={{ margin: 0 }}>Giełda Papierów Wartościowych</h3>
                                        <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>Zarządzaj kapitałem własnym i przejmuj dominację na rynku.</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#2ecc71' }}>{fmt(stockPrice)} PLN</div>
                                        <div style={{ fontSize: '11px', color: '#666' }}>KURS AKCJI</div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                                    {/* Lewa — struktura właścicielska */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <h4>Struktura Akcjonariatu</h4>
                                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
                                            {/* Gracz */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(42,74,42,0.3)' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#f0c040' }}>{playerDoc.companyName || 'Ty'}</span>
                                                <span style={{ fontSize: '11px', color: '#888' }}>{fmt(playerShares)} akcji</span>
                                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#2ecc71', minWidth: '55px', textAlign: 'right' }}>{playerPct}%</span>
                                            </div>
                                            {/* Wolny obrót */}
                                            {freeFloat > 0 && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', padding: '7px 12px', borderBottom: shareholders.length ? '1px solid rgba(42,74,42,0.2)' : 'none', opacity: 0.6 }}>
                                                    <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>Wolny obrót (nieobsadzony)</span>
                                                    <span style={{ fontSize: '10px', color: '#888' }}>{fmt(freeFloat)} akcji</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#888', minWidth: '55px', textAlign: 'right' }}>{(freeFloat / totalShares * 100).toFixed(2)}%</span>
                                                </div>
                                            )}
                                            {/* Pozostali akcjonariusze (prawdziwi gracze) */}
                                            {shareholders.map(sh => (
                                                <div key={sh.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid rgba(42,74,42,0.2)' }}>
                                                    <span style={{ fontSize: '11px', color: '#c0c0c0' }}>{sh.name}</span>
                                                    <span style={{ fontSize: '10px', color: '#888' }}>{fmt(sh.shares)} akcji</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#d0d0d0', minWidth: '55px', textAlign: 'right' }}>{(sh.shares / totalShares * 100).toFixed(2)}%</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '11px', color: '#666' }}>
                                            <span>Łączna kapitalizacja:</span>
                                            <span style={{ color: '#fff', fontWeight: '700' }}>{fmt(marketCap)} PLN</span>
                                        </div>

                                        {/* Emisja */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginTop: '4px' }}>
                                            {[0.05, 0.10, 0.15, 0.20].map(pct => (
                                                <button key={pct} onClick={() => emitShares(pct)}
                                                    className={styles.saveBtn}
                                                    style={{ margin: 0, padding: '6px 4px', fontSize: '10px', background: '#27ae60', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto', gap: '1px' }}>
                                                    <span style={{ fontWeight: '800' }}>+{pct * 100}%</span>
                                                    <span style={{ opacity: 0.8, fontSize: '9px' }}>{fmt(Math.round(totalShares * pct / (1 - pct)) * stockPrice)} PLN</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#4a6a4a', letterSpacing: '1px' }}>EMISJA NOWYCH AKCJI — ROZCIEŃCZENIE O X%</div>
                                    </div>

                                    {/* Prawa — historia emisji */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <h4>Historia Emisji</h4>
                                        {!emissions?.length ? (
                                            <div style={{ fontSize: '11px', color: '#4a6a4a', letterSpacing: '1px', padding: '10px 0' }}>BRAK EMISJI</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '220px' }}>
                                                {[...emissions].reverse().map(em => (
                                                    <div key={em.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '8px 12px', border: '1px solid rgba(42,74,42,0.3)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                            <span style={{ fontSize: '11px', color: '#888' }}>{new Date(em.date).toLocaleDateString('pl-PL')}</span>
                                                            {em.buyers?.length > 0 && <span style={{ fontSize: '11px', color: '#2ecc71', fontWeight: '700' }}>+{fmt(em.buyers.reduce((s, b) => s + b.shares * em.pricePerShare, 0))} PLN</span>}
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>{fmt(em.sharesIssued)} akcji po {fmt(em.pricePerShare)} PLN</div>
                                                        {em.buyers?.length ? em.buyers.map(b => (
                                                            <div key={b.playerId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '2px 0', borderTop: '1px solid rgba(42,74,42,0.15)' }}>
                                                                <span style={{ color: '#c0d8c0' }}>{b.name}</span>
                                                                <span style={{ color: '#f0c040' }}>{fmt(b.shares)} szt. ({b.pct}%)</span>
                                                            </div>
                                                        )) : (
                                                            <div style={{ fontSize: '10px', color: '#4a6a4a', fontStyle: 'italic', borderTop: '1px solid rgba(42,74,42,0.15)', paddingTop: '3px' }}>Brak nabywców</div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </section>
            </div>
        </>
    );
};

export default FinanceSection;
