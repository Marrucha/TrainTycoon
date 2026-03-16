import React from 'react';
import styles from '../CompanyMenu.module.css';

const PolicySection = ({ companyName, defaultPricing }) => (
    <>
        <div className={styles.sectionHeader}>
            <h2>Polityka Firmy</h2>
            <p>Definiuj tożsamość i kierunki rozwoju swojej korporacji.</p>
        </div>
        <div className={styles.grid}>
            <section className={styles.card}>
                <h3>Profil Korporacyjny</h3>
                <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                    <div style={{ width: '240px', height: '240px', background: '#0d1a0d', borderRadius: '24px', border: '2px solid #2a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '20px' }}>
                        <img src="/wolfrail-logo.png" alt="WolfRail Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                            <label style={{ fontSize: '9px', color: '#666', letterSpacing: '1px' }}>NAZWA OPERATORA</label>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>{companyName || 'Nieustalona'}</div>
                        </div>
                        <button className={styles.saveBtn} style={{ background: '#2c3e50', margin: 0, fontSize: '10px', padding: '6px 12px' }}>Edytuj Branding</button>
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

export default PolicySection;
