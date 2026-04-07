import React from 'react';
import styles from '../CompanyMenu.module.css';

const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
};

const FleetSection = ({
    fleetData,
    groupBy,
    setGroupBy,
    sortOrder,
    setSortOrder,
    expandedGroups,
    toggleGroup,
    performMaintenance
}) => (
    <>
        <div className={styles.sectionHeader} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '15px' }}>
            <div>
                <h2>Stan Taboru</h2>
                <p>Monitoring techniczny i harmonogram remontów Twojej floty.</p>
            </div>

            {/* Controls Line */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', background: 'rgba(0,20,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid #2a4a2a' }}>
                <div style={{ display: 'flex', background: '#0a150a', padding: '3px', borderRadius: '6px', marginRight: '15px', border: '1px solid #2a4a2a' }}>
                    {[
                        { key: 'type',   label: 'Po typie'    },
                        { key: 'detail', label: 'Detaliczny'  },
                        { key: 'set',    label: 'Wg składów'  },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            className={styles.saveBtn}
                            style={{ background: groupBy === key ? '#2a4a2a' : 'transparent', color: groupBy === key ? '#f0c040' : '#8aab8a', padding: '6px 12px', fontSize: '11px', margin: 0, height: '30px' }}
                            onClick={() => setGroupBy(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', background: '#0a150a', padding: '3px', borderRadius: '6px', border: '1px solid #2a4a2a' }}>
                    <button
                        className={styles.saveBtn}
                        style={{ background: sortOrder === 'desc' ? '#2a4a2a' : 'transparent', border: sortOrder === 'desc' ? '1px solid #f0c040' : 'none', color: sortOrder === 'desc' ? '#f0c040' : '#8aab8a', padding: '0 15px', fontSize: '11px', margin: 0, height: '30px', display: 'flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => setSortOrder('desc')}
                    >
                        Sprawność ↓
                    </button>
                    <button
                        className={styles.saveBtn}
                        style={{ background: sortOrder === 'asc' ? '#2a4a2a' : 'transparent', border: sortOrder === 'asc' ? '1px solid #f0c040' : 'none', color: sortOrder === 'asc' ? '#f0c040' : '#8aab8a', padding: '0 15px', fontSize: '11px', margin: 0, height: '30px', display: 'flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => setSortOrder('asc')}
                    >
                        Sprawność ↑
                    </button>
                </div>
            </div>
        </div>

        {groupBy === 'detail' && (
            <div className={styles.taborList}>
                <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 60px 70px 80px 100px', gap: 0, padding: '8px 16px', background: 'rgba(0,30,0,0.4)', borderBottom: '1px solid #2a4a2a' }}>
                        {['Nazwa', 'Typ', 'Wejście do służby', 'Wiek', 'Spr.', 'Status', ''].map((h, i) => (
                            <span key={i} style={{ fontSize: 9, color: '#6a8a6a', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{h}</span>
                        ))}
                    </div>
                    {fleetData.map(t => (
                        <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 60px 70px 80px 100px', gap: 0, padding: '9px 16px', borderBottom: '1px solid rgba(42,74,42,0.2)', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>{t.name}</span>
                            <span style={{ fontSize: 11, color: '#8aab8a', background: '#060f06', padding: '2px 6px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>{t.type || '—'}</span>
                            <span style={{ fontSize: 11, color: '#aaa', fontFamily: 'Share Tech Mono, monospace' }}>{fmtDate(t.purchasedAt)}</span>
                            <span style={{ fontSize: 11, color: '#f0c040' }}>{t.ageYears != null ? `${t.ageYears} lat` : '—'}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: t.condition > 80 ? '#2ecc71' : t.condition > 65 ? '#f1c40f' : '#e74c3c' }}>{t.condition}%</span>
                            <span>
                                {t.status === 'READY'        && <span className={`${styles.badge} ${styles.badgeReady}`}>Operacyjny</span>}
                                {t.status === 'MAINTENANCE'  && <span className={`${styles.badge} ${styles.badgeService}`}>Serwis</span>}
                                {t.status === 'OVERHAUL'     && <span className={`${styles.badge} ${styles.badgeRepair}`}>Remont</span>}
                            </span>
                            <button
                                className={styles.saveBtn}
                                style={{ padding: '4px 10px', fontSize: 10, background: '#0a150a', border: '1px solid #2a4a2a', color: '#8aab8a', margin: 0, textTransform: 'uppercase' }}
                                onClick={() => performMaintenance(t.id)}
                            >
                                Konserwacja
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {groupBy !== 'detail' && <div className={styles.taborList}>
            {fleetData.map(group => {
                const isExpanded = expandedGroups[group.id];
                return (
                    <div key={group.id} className={styles.card} style={{ padding: '0', overflow: 'hidden', borderLeft: `6px solid ${group.status === 'READY' ? '#2ecc71' : (group.status === 'MAINTENANCE' ? '#f1c40f' : '#e74c3c')}` }}>
                        {/* Header: Pure Set Name/Type */}
                        <div
                            style={{ padding: '12px 20px', background: 'rgba(0,30,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: isExpanded ? '1px solid #2a4a2a' : 'none' }}
                            onClick={() => toggleGroup(group.id)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '12px', color: '#666', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                                <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {group.name}
                                </div>
                            </div>
                            <div className={styles.taborStatus}>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    {group.isGroup ? (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <span className={styles.statLabel} style={{ fontSize: '9px' }}>ŚREDNIA SPRAWNOŚĆ</span>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{group.condition}%</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderLeft: '1px solid #333', paddingLeft: '15px' }}>
                                                <span className={styles.statLabel} style={{ fontSize: '9px' }}>MINIMALNA SPRAWNOŚĆ</span>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: group.minCondition > 65 ? '#fff' : '#e74c3c' }}>{group.minCondition}%</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span className={styles.statLabel} style={{ fontSize: '9px' }}>SPRAWNOŚĆ</span>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: group.condition > 65 ? '#fff' : '#e74c3c' }}>{group.condition}%</span>
                                        </div>
                                    )}
                                    {group.status === 'READY' && <span className={`${styles.badge} ${styles.badgeReady}`}>Operacyjny</span>}
                                    {group.status === 'MAINTENANCE' && <span className={`${styles.badge} ${styles.badgeService}`}>Serwis</span>}
                                    {group.status === 'OVERHAUL' && <span className={`${styles.badge} ${styles.badgeRepair}`}>Remont</span>}
                                    {group.isGroup && group.members.length > 0 && (
                                        <button
                                            className={styles.saveBtn}
                                            style={{
                                                padding: '6px 14px',
                                                fontSize: '10px',
                                                background: 'transparent',
                                                border: '1px solid #f0c040',
                                                color: '#f0c040',
                                                margin: 0,
                                                textTransform: 'uppercase',
                                                fontWeight: 700,
                                                marginLeft: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`Czy na pewno przeprowadzić konserwację wszystkich elementów składu ${group.name}?`)) {
                                                    group.members.forEach(m => performMaintenance(m.id));
                                                }
                                            }}
                                        >
                                            <span style={{ fontSize: '14px' }}>🛠</span> Konserwacja Składu
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Elements list directly below, collapsible */}
                        {isExpanded && (
                            <div style={{ padding: '5px 15px 15px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,10,0,0.1)' }}>
                                {group.members.map(m => (
                                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'rgba(13,26,13,0.3)', borderRadius: '4px', border: '1px solid #2a4a2a' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#eee' }}>{m.name}</span>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '3px' }}>
                                                <span style={{ fontSize: '11px', background: '#060f06', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', color: m.ageYears != null ? '#f0c040' : '#555' }}>
                                                    {m.ageYears != null ? `${m.ageYears} lat` : 'wiek nieznany'}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#8aab8a' }}>| Typ: {m.type}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: m.condition > 80 ? '#2ecc71' : (m.condition > 65 ? '#f1c40f' : '#e74c3c') }}>
                                                {m.condition}%
                                            </span>
                                            <button
                                                className={styles.saveBtn}
                                                style={{ padding: '5px 12px', fontSize: '10px', background: '#0a150a', border: '1px solid #2a4a2a', color: '#8aab8a', margin: 0, textTransform: 'uppercase' }}
                                                onClick={(e) => { e.stopPropagation(); performMaintenance(m.id); }}
                                            >
                                                Konserwacja
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>}
    </>
);

export default FleetSection;
