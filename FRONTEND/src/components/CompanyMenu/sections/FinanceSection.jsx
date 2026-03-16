import React from 'react';
import styles from '../CompanyMenu.module.css';

const FinanceSection = ({
    budget,
    reputation,
    playerDoc,
    openCreditLine,
    takeLoan,
    toggleGroup,
    expandedGroups
}) => (
    <>
        <div className={styles.sectionHeader}>
            <h2>Finanse</h2>
            <p>Analizuj przepływy pieniężne i rentowność połączeń.</p>
        </div>
        <div className={styles.grid}>
            <section className={styles.card}>
                <h3>Bilans</h3>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Środki Operacyjne</span>
                    <span className={styles.statValue} style={{ color: '#2ecc71', fontSize: '32px' }}>
                        {Math.round(budget).toLocaleString()} PLN
                    </span>
                </div>
            </section>
            <section className={styles.card}>
                <h3>Reputacja Rynkowa</h3>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Rating Trust-Score</span>
                    <span className={styles.statValue} style={{ color: '#f1c40f' }}>
                        {(reputation * 100).toFixed(1)}%
                    </span>
                </div>
            </section>
        </div>

        <div className={styles.sectionHeader} style={{ marginTop: '30px' }}>
            <h2>Sektor Bankowy</h2>
            <p>Zarządzaj kredytami, lokatami i akcjami swojej firmy.</p>
        </div>

        <div className={styles.grid}>
            {/* Kredyty i Linie Kredytowe */}
            <section className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3>Instrumenty Dłużne</h3>
                    <span style={{ fontSize: '12px', color: '#666' }}>Zdolność: 500.000.000 PLN</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {/* Linia Kredytowa */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600' }}>Linia Kredytowa (100 mln)</span>
                            <span style={{ fontSize: '13px', color: '#888' }}>Koszt: 0.1% / m-c</span>
                        </div>
                        {playerDoc.finance?.creditLine ? (
                            <div style={{ padding: '8px', background: 'rgba(46, 204, 113, 0.1)', borderRadius: '4px', border: '1px solid #2ecc71', fontSize: '11px', color: '#2ecc71', textAlign: 'center' }}>
                                AKTYWNA (Koszt: {(playerDoc.finance.creditLine.limit * 0.001).toLocaleString()} PLN)
                            </div>
                        ) : (
                            <button
                                className={styles.saveBtn}
                                style={{ width: '100%', padding: '8px', fontSize: '11px', margin: '5px 0 0 0' }}
                                onClick={() => openCreditLine(100000000)}
                            >
                                Otwórz Linię
                            </button>
                        )}
                    </div>

                    {/* Kredyt Inwestycyjny */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600' }}>Kredyty Inwestycyjne</span>
                            <span style={{ fontSize: '11px', color: '#888' }}>Spłata: 24 m-ce</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {[
                                { amt: 20000000, label: '20 mln', rate: '5.0%' },
                                { amt: 50000000, label: '50 mln', rate: '5.2%' },
                                { amt: 100000000, label: '100 mln', rate: '5.4%' },
                                { amt: 200000000, label: '200 mln', rate: '5.6%' }
                            ].map(loan => (
                                <button
                                    key={loan.amt}
                                    className={styles.saveBtn}
                                    style={{ padding: '6px', fontSize: '10px', margin: 0, background: '#e67e22', display: 'flex', flexDirection: 'column', height: 'auto', alignItems: 'center' }}
                                    onClick={() => takeLoan(loan.amt, 24)}
                                >
                                    <span style={{ fontWeight: '800' }}>{loan.label}</span>
                                    <span style={{ opacity: 0.8, fontSize: '9px' }}>Koszt: {loan.rate}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Harmonogram spłat kredytów */}
                    {playerDoc.finance?.loans?.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                            <h4 style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Aktywne Kredyty / Harmonogram</h4>
                            {playerDoc.finance.loans.map(loan => (
                                <div key={loan.id} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '6px', marginBottom: '6px', overflow: 'hidden', border: '1px solid rgba(243, 156, 18, 0.2)' }}>
                                    <div
                                        style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                        onClick={() => toggleGroup(`loan-${loan.id}`)}
                                    >
                                        <span style={{ fontSize: '12px', fontWeight: '700' }}>Kredyt #{loan.id.slice(-4)}</span>
                                        <span style={{ fontSize: '12px', color: '#f39c12' }}>Pozostało: {loan.remainingMonths} m-cy</span>
                                    </div>
                                    {expandedGroups[`loan-${loan.id}`] && (
                                        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                                                <span style={{ color: '#888' }}>Kwota raty:</span>
                                                <span style={{ color: '#fff', fontWeight: '700' }}>{loan.monthlyPayment.toLocaleString()} PLN</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                <span style={{ color: '#888' }}>Do spłaty łącznie:</span>
                                                <span style={{ color: '#fff' }}>{loan.totalToRepay.toLocaleString()} PLN</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Lokaty i Depozyty */}
            <section className={styles.card}>
                <h3>Depozyty i Lokaty</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '5px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600' }}>Lokata Terminowa (30 dni)</span>
                            <span style={{ fontSize: '13px', color: '#2ecc71' }}>Zysk: +2.5%</span>
                        </div>
                        <button className={styles.saveBtn} style={{ width: '100%', padding: '8px', fontSize: '11px', margin: '5px 0 0 0', background: '#27ae60' }}>Załóż Lokatę</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ fontSize: '11px', color: '#666' }}>ŚRODKI ZABLOKOWANE:</span>
                        <span style={{ fontSize: '14px', fontWeight: '700' }}>0 PLN</span>
                    </div>
                </div>
            </section>

            {/* Zarządzanie Akcjami (GPW) */}
            <section className={styles.card} style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>Giełda Papierów Wartościowych</h3>
                        <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>Zarządzaj kapitałem własnym i przejmuj dominację na rynku.</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#2ecc71' }}>142.50 PLN</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>KURS TWOICH AKCJI (+2.4%)</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h4>Twoje Udziały</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#777' }}>Pakiet Kontrolny:</span>
                            <span style={{ fontSize: '12px', fontWeight: '700' }}>51.0%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#777' }}>Kapitalizacja:</span>
                            <span style={{ fontSize: '12px', fontWeight: '700' }}>1.425.000.000 PLN</span>
                        </div>
                        <button className={styles.saveBtn} style={{ background: '#27ae60', margin: '10px 0 0 0', fontWeight: '700' }}>Emituj Nowe Akcje</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <h4>Rynek Konkurencji</h4>
                        {[
                            { name: 'RailWay Star', price: '89.20', trend: '-1.2%', color: '#e74c3c' },
                            { name: 'EcoTrain Ltd', price: '210.45', trend: '+0.8%', color: '#2ecc71' }
                        ].map(comp => (
                            <div key={comp.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700' }}>{comp.name}</span>
                                    <span style={{ fontSize: '10px', color: comp.color }}>{comp.price} PLN ({comp.trend})</span>
                                </div>
                                <button className={styles.saveBtn} style={{ padding: '5px 12px', fontSize: '10px', background: 'transparent', border: '1px solid #f0c040', color: '#f0c040', margin: 0 }}>Kup</button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    </>
);

export default FinanceSection;
