import { useGame } from '../../../../context/GameContext'
import { auth } from '../../../../firebase/config'
import styles from '../../CompanyMenu.module.css'

const fmt = (n) => Math.round(n).toLocaleString('pl-PL')

export default function FinanceStock({ playerDoc, emitShares }) {
    const { listedCompanies } = useGame()
    const myUid = auth.currentUser?.uid
    const liveExchange = listedCompanies?.find(c => c.id === myUid)
    
    const co = playerDoc.company ?? { totalShares: 1000000, playerShares: 1000000, stockPrice: 100, freeFloat: 0, shareholders: [], emissions: [] }
    const { totalShares, playerShares, freeFloat = 0, shareholders = [], emissions = [] } = co
    const stockPrice = liveExchange?.marketPrice || liveExchange?.fundamentalPrice || co.stockPrice || 100
    const prevDayPrice = liveExchange?.prevDayPrice || stockPrice
    const chg = (prevDayPrice && prevDayPrice > 0) ? ((stockPrice - prevDayPrice) / prevDayPrice) * 100 : null
    
    const playerPct = (playerShares / totalShares * 100).toFixed(2)
    const marketCap = totalShares * stockPrice

    return (
        <section className={styles.card} style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Giełda Papierów Wartościowych</h3>
                    <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>Zarządzaj kapitałem własnym i przejmuj dominację na rynku.</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff' }}>{stockPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN</div>
                        {chg !== null && (
                            <div style={{ fontSize: '13px', fontWeight: '800', color: chg > 0 ? '#2ecc71' : chg < 0 ? '#e74c3c' : '#888' }}>
                                {chg > 0 ? '▲' : chg < 0 ? '▼' : '—'} {Math.abs(chg).toFixed(2)}%
                            </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#a0c0a0', fontWeight: '800', letterSpacing: '1px', marginTop: '2px' }}>KURS AKCJI</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                {/* Struktura właścicielska */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4>Struktura Akcjonariatu</h4>
                    <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(42,74,42,0.3)' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#f0c040' }}>{playerDoc.companyName || 'Ty'}</span>
                            <span style={{ fontSize: '11px', color: '#888' }}>{fmt(playerShares)} akcji</span>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#2ecc71', minWidth: '55px', textAlign: 'right' }}>{playerPct}%</span>
                        </div>
                        {freeFloat > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', padding: '7px 12px', borderBottom: shareholders.length ? '1px solid rgba(42,74,42,0.2)' : 'none', opacity: 0.6 }}>
                                <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>Wolny obrót (nieobsadzony)</span>
                                <span style={{ fontSize: '10px', color: '#888' }}>{fmt(freeFloat)} akcji</span>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#888', minWidth: '55px', textAlign: 'right' }}>{(freeFloat / totalShares * 100).toFixed(2)}%</span>
                            </div>
                        )}
                        {shareholders.map((sh, idx) => (
                            <div key={sh.playerId || sh.name || idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid rgba(42,74,42,0.2)' }}>
                                <span style={{ fontSize: '11px', color: '#c0c0c0' }}>{sh.name}</span>
                                <span style={{ fontSize: '10px', color: '#888' }}>{fmt(sh.shares)} akcji</span>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#d0d0d0', minWidth: '55px', textAlign: 'right' }}>{(sh.shares / totalShares * 100).toFixed(2)}%</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '11px', color: '#a0c0a0', fontWeight: '800' }}>
                        <span>Łączna kapitalizacja:</span>
                        <span style={{ color: '#fff', fontWeight: '700' }}>{fmt(marketCap)} PLN</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginTop: '4px' }}>
                        {[0.05, 0.10, 0.15, 0.20].map(pct => (
                            <button key={pct} onClick={() => emitShares(pct)}
                                className={styles.shareBtn}
                                style={{ margin: 0, padding: '7px 4px', fontSize: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto', gap: '2px' }}>
                                <span style={{ fontWeight: '800', color: '#f0c040' }}>+{pct * 100}%</span>
                                <span style={{ color: '#8aab8a', fontSize: '9px', fontWeight: '600' }}>{fmt(Math.round(totalShares * pct / (1 - pct)) * stockPrice)} PLN</span>
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: '9px', color: '#4a6a4a', letterSpacing: '1px' }}>EMISJA NOWYCH AKCJI — ROZCIEŃCZENIE O X%</div>
                </div>

                {/* Historia emisji */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4>Historia Emisji</h4>
                    {!emissions?.length ? (
                        <div style={{ fontSize: '11px', color: '#4a6a4a', letterSpacing: '1px', padding: '10px 0' }}>BRAK EMISJI</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '220px' }}>
                            {[...emissions].reverse().map((em, idx) => (
                                <div key={em.id || `em-${idx}`} style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '6px', padding: '8px 12px', border: '1px solid rgba(42,74,42,0.4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', color: '#888' }}>{new Date(em.date).toLocaleDateString('pl-PL')}</span>
                                        {em.buyers?.length > 0 && <span style={{ fontSize: '11px', color: '#2ecc71', fontWeight: '700' }}>+{fmt(em.buyers.reduce((s, b) => s + b.shares * em.pricePerShare, 0))} PLN</span>}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>{fmt(em.sharesIssued)} akcji po {fmt(em.pricePerShare)} PLN</div>
                                    {em.buyers?.length ? em.buyers.map((b, bIdx) => (
                                        <div key={b.playerId || bIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '2px 0', borderTop: '1px solid rgba(42,74,42,0.15)' }}>
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
        </section>
    )
}
