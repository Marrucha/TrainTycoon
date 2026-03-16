import React from 'react';
import styles from '../CompanyMenu.module.css';

const HRSection = () => (
    <>
        <div className={styles.sectionHeader}>
            <h2>Kadry (HR)</h2>
            <p>Zarządzaj zespołem maszynistów, konduktorów i personelu technicznego.</p>
        </div>
        <div className={styles.grid}>
            <section className={styles.card}>
                <h3>Zatrudnienie</h3>
                <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Pracownicy ogółem</span>
                        <span className={styles.statValue}>124</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Wakatów</span>
                        <span className={styles.statValue}>12</span>
                    </div>
                </div>
            </section>
            <section className={styles.card}>
                <h3>Wydajność Zespołu</h3>
                <div style={{ height: '10px', background: '#000', borderRadius: '5px', marginTop: '10px', overflow: 'hidden' }}>
                    <div style={{ width: '85%', height: '100%', background: '#f1c40f' }}></div>
                </div>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Średni poziom zadowolenia: 85%</p>
            </section>
        </div>
    </>
);

export default HRSection;
