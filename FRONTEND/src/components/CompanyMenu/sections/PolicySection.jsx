import React from 'react';
import styles from '../CompanyMenu.module.css';

const ReputationBar = ({ label, value, max = 20, color = '#2ecc71', thick }) => (
    <div style={{ marginBottom: thick ? '20px' : '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: thick ? '13px' : '11px', color: '#fff', fontWeight: '800', letterSpacing: '1px' }}>
            <span>{label}</span>
            <span>{value} <span style={{ opacity: 0.6 }}>/ {max}</span></span>
        </div>
        <div style={{ height: thick ? '16px' : '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, boxShadow: `0 0 15px ${color}55`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>
    </div>
);

const PolicySection = ({ companyName, defaultPricing, reputation, playerDoc }) => {
    const totalScore = Math.round(reputation * 100);
    const details = playerDoc?.reputationDetails || {};

    const subScores = [
        { label: "PUNKTUALNOŚĆ", val: details.punctualityScore !== undefined ? Math.round(details.punctualityScore) : 10 },
        { label: "STAŁOŚĆ TRAS", val: details.stabilityScore !== undefined ? Math.round(details.stabilityScore) : 10 },
        { label: "NOWOCZESNOŚĆ TABORU", val: details.modernityScore !== undefined ? Math.round(details.modernityScore) : 10 },
        { label: "KONKURENCYJNOŚĆ CEN", val: details.priceScore !== undefined ? Math.round(details.priceScore) : 10 },
        { label: "% PRZEWIEZIONYCH VS POPYT", val: details.fillRateScore !== undefined ? Math.round(details.fillRateScore) : 10 }
    ];

    return (
        <>
            <div className={styles.sectionHeader}>
                <h2>Polityka Firmy</h2>
                <p>Definiuj tożsamość i kierunki rozwoju swojej korporacji.</p>
            </div>
            <div className={styles.grid}>
                <section className={styles.card} style={{ background: 'rgba(10, 30, 10, 0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}>
                    <h3>Profil Korporacyjny</h3>
                    <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                        <div style={{ minWidth: '150px', height: '150px', background: 'rgba(13,26,13,0.6)', borderRadius: '24px', border: '1px solid rgba(46,204,113,0.3)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '15px' }}>
                            <img src="/wolfrail-logo.png" alt="WolfRail Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1 }}>
                            <div>
                                <label style={{ fontSize: '10px', color: '#8aab8a', letterSpacing: '2px', fontWeight: 'bold' }}>NAZWA OPERATORA</label>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff', borderBottom: '1px solid rgba(46,204,113,0.2)', paddingBottom: '4px' }}>{companyName || 'Nieustalona'}</div>
                            </div>
                            <button className={styles.saveBtn} style={{ background: '#2c3e50', margin: 0, fontSize: '10px', padding: '6px 12px', width: 'fit-content' }}>Edytuj Branding</button>
                        </div>
                    </div>
                </section>

                <section className={styles.card} style={{ background: 'rgba(10, 30, 10, 0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', height: 'fit-content' }}>
                    <h3 style={{ fontSize: '16px', color: '#f1c40f', marginBottom: '20px' }}>Wskaźniki Reputacji (Trust-Score)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <ReputationBar label="WSKAŹNIK REPUTACJI (GLOBALNY)" value={totalScore} max={100} color="#f1c40f" thick />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '40px', rowGap: '15px', marginTop: '10px' }}>
                            {subScores.map(s => (
                                <ReputationBar key={s.label} label={s.label} value={s.val} max={20} color="#2ecc71" />
                            ))}
                        </div>
                    </div>
                </section>
                
                <section className={styles.card}>
                    <h3>Strategia Cenowa</h3>
                    <div className={styles.statsGrid}>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Kl. 1 (100km)</span>
                            <span className={styles.statValue}>{defaultPricing.class1Per100km} PLN</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Kl. 2 (100km)</span>
                            <span className={styles.statValue}>{defaultPricing.class2Per100km} PLN</span>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
};

export default PolicySection;
