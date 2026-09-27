import React, { useState, useEffect } from 'react';
import styles from '../CompanyMenu.module.css';

const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
};

const fmtDateTime = (d) => {
    if (!d) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${mins}`;
};

const calcSingleCost = (m) => {
    const price = m.price || ((m.speed || 100) * (m.seats || 50) * 100) || 500000;
    const damage = Math.max(0.05, 1 - (m.condition || 100) / 100);
    return Math.max(5000, Math.round(price * 0.015 * damage));
};

export default function FleetSection({
    fleetData,
    groupBy,
    setGroupBy,
    sortOrder,
    setSortOrder,
    expandedGroups,
    toggleGroup,
    performMaintenance,
    startMaintenance,
    completeMaintenance,
    gameDate,
    budget,
}) {
    const [confirmModal, setConfirmModal] = useState(null);
    const [realNow, setRealNow] = useState(Date.now());

    const hasAnyInMaintenance = (fleetData || []).some(item => {
        if (item.members) {
            return item.members.some(m => m.maintenanceStartedAt && !m.maintenanceComplete);
        }
        return item.maintenanceStartedAt && !item.maintenanceComplete;
    });

    useEffect(() => {
        if (!hasAnyInMaintenance) return;
        const id = setInterval(() => {
            const now = Date.now();
            setRealNow(now);

            if (completeMaintenance) {
                fleetData.forEach(item => {
                    const members = item.members || [item];
                    members.forEach(m => {
                        if (m.maintenanceStartedAt && !m.maintenanceComplete) {
                            const duration = m.maintenanceDurationMs || 15000;
                            if (now - m.maintenanceStartedAt >= duration) {
                                completeMaintenance(m.id);
                            }
                        }
                    });
                });
            }
        }, 500);
        return () => clearInterval(id);
    }, [hasAnyInMaintenance, fleetData, completeMaintenance]);

    const openConfirmModal = (name, members) => {
        const totalCost = members.reduce((sum, m) => sum + calcSingleCost(m), 0);
        const durationHours = 12;
        const finishDate = gameDate
            ? new Date(gameDate.getTime() + durationHours * 3600 * 1000)
            : new Date(Date.now() + 24 * 60 * 1000);

        setConfirmModal({
            name,
            members,
            cost: totalCost,
            durationHours,
            finishDate,
        });
    };

    const handleExecuteMaintenance = async () => {
        if (!confirmModal) return;
        const { members, cost, durationHours } = confirmModal;
        const ids = members.map(m => m.id);

        if (startMaintenance) {
            await startMaintenance(ids, cost, durationHours);
        } else if (performMaintenance) {
            members.forEach(m => performMaintenance(m.id));
        }
        setConfirmModal(null);
    };

    return (
        <>
            {confirmModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, padding: '20px'
                }}>
                    <div style={{
                        background: '#0a160a', border: '1px solid #f0c040',
                        borderRadius: '8px', width: '100%', maxWidth: '520px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.8)', padding: '24px',
                        color: '#eee', display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1a331a', paddingBottom: '12px' }}>
                            <span style={{ fontSize: '24px' }}>🛠</span>
                            <div>
                                <h3 style={{ margin: 0, color: '#f0c040', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Zlecenie Konserwacji Taboru
                                </h3>
                                <span style={{ fontSize: '12px', color: '#8aab8a' }}>{confirmModal.name}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,20,0,0.3)', padding: '14px', borderRadius: '6px', border: '1px solid #1a331a' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#8aab8a' }}>Liczba elementów:</span>
                                <strong style={{ color: '#fff' }}>{confirmModal.members.length} szt.</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#8aab8a' }}>Szacowany czas prac:</span>
                                <strong style={{ color: '#f0c040' }}>{confirmModal.durationHours} godz. gry</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#8aab8a' }}>Planowane zakończenie:</span>
                                <strong style={{ color: '#2ecc71', fontFamily: 'Share Tech Mono, monospace' }}>
                                    {fmtDateTime(confirmModal.finishDate)}
                                </strong>
                            </div>
                            <div style={{ height: '1px', background: '#1a331a', margin: '4px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                                <span style={{ color: '#8aab8a', fontWeight: 'bold' }}>Łączny koszt:</span>
                                <strong style={{ color: '#f1c40f', fontSize: '17px' }}>
                                    {confirmModal.cost.toLocaleString('pl-PL')} PLN
                                </strong>
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(231, 76, 60, 0.12)', border: '1px solid #e74c3c',
                            borderRadius: '6px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px'
                        }}>
                            <span style={{ fontSize: '18px' }}>⚠️</span>
                            <span style={{ fontSize: '11px', color: '#fca5a5', lineHeight: '1.4' }}>
                                <strong>Ważne:</strong> Skład w trakcie konserwacji zostaje wycofany z obsługi tras pasażerskich do momentu zakończenia prac serwisowych.
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                            <button
                                onClick={() => setConfirmModal(null)}
                                style={{
                                    background: 'transparent', border: '1px solid #555', color: '#aaa',
                                    padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600
                                }}
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={handleExecuteMaintenance}
                                style={{
                                    background: '#1b4332', border: '1px solid #2ecc71', color: '#2ecc71',
                                    padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.5px'
                                }}
                            >
                                Rozpocznij Konserwację ({confirmModal.cost.toLocaleString('pl-PL')} PLN)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.sectionHeader}>
                <h2>Stan Taboru</h2>
                <p>Monitoring techniczny i harmonogram remontów Twojej floty.</p>
            </div>

        {/* Controls Line */}
        <div style={{ display: 'flex', gap: '8px', width: '100%', background: 'rgba(0,20,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid #2a4a2a', marginBottom: '20px' }}>
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

        {groupBy === 'detail' && (
            <div className={styles.taborList}>
                <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 60px 70px 80px 100px', gap: 0, padding: '8px 16px', background: 'rgba(0,30,0,0.4)', borderBottom: '1px solid #2a4a2a' }}>
                        {['Nazwa', 'Typ', 'Wejście do służby', 'Wiek', 'Spr.', 'Status', ''].map((h, i) => (
                            <span key={i} style={{ fontSize: 9, color: '#6a8a6a', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{h}</span>
                        ))}
                    </div>
                    {fleetData.map(t => {
                        const inMaint = t.maintenanceStartedAt && !t.maintenanceComplete;
                        const prog = inMaint
                            ? Math.min(1, (realNow - t.maintenanceStartedAt) / (t.maintenanceDurationMs || 15000))
                            : 0;
                        return (
                            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 60px 70px 100px 120px', gap: 0, padding: '9px 16px', borderBottom: '1px solid rgba(42,74,42,0.2)', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>{t.name}</span>
                                    {inMaint && (
                                        <div style={{ marginTop: 4, width: '120px', height: 4, background: '#0a1a0a', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.round(prog * 100)}%`, height: '100%', background: '#2ecc71', transition: 'width 0.3s' }} />
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: 11, color: '#8aab8a', background: '#060f06', padding: '2px 6px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>{t.type || '—'}</span>
                                <span style={{ fontSize: 11, color: '#aaa', fontFamily: 'Share Tech Mono, monospace' }}>{fmtDate(t.purchasedAt)}</span>
                                <span style={{ fontSize: 11, color: '#f0c040' }}>{t.ageYears != null ? `${t.ageYears} lat` : '15.0 lat'}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: inMaint ? '#2ecc71' : (t.condition > 80 ? '#2ecc71' : t.condition > 65 ? '#f1c40f' : '#e74c3c') }}>
                                    {inMaint ? `${Math.round(prog * 100)}%` : `${t.condition}%`}
                                </span>
                                <span>
                                    {inMaint ? (
                                        <span className={`${styles.badge} ${styles.badgeService}`}>🔧 Serwis</span>
                                    ) : (
                                        <>
                                            {t.status === 'READY'        && <span className={`${styles.badge} ${styles.badgeReady}`}>Operacyjny</span>}
                                            {t.status === 'MAINTENANCE'  && <span className={`${styles.badge} ${styles.badgeService}`}>Serwis</span>}
                                            {t.status === 'OVERHAUL'     && <span className={`${styles.badge} ${styles.badgeRepair}`}>Remont</span>}
                                        </>
                                    )}
                                </span>
                                {inMaint ? (
                                    <span style={{ fontSize: 10, color: '#2ecc71', fontWeight: 700 }}>
                                        🔧 {Math.round(prog * 100)}%
                                    </span>
                                ) : (
                                    <button
                                        className={styles.saveBtn}
                                        style={{ padding: '4px 10px', fontSize: 10, background: '#0a150a', border: '1px solid #2a4a2a', color: '#8aab8a', margin: 0, textTransform: 'uppercase' }}
                                        onClick={() => openConfirmModal(t.name, [t])}
                                    >
                                        Konserwacja
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {groupBy !== 'detail' && <div className={styles.taborList}>
            {fleetData.map(group => {
                const isExpanded = expandedGroups[group.id];
                const members = group.members || [];
                const inMaintMembers = members.filter(m => m.maintenanceStartedAt && !m.maintenanceComplete);
                const hasMaintenance = inMaintMembers.length > 0;

                const avgProgress = hasMaintenance
                    ? Math.round(inMaintMembers.reduce((s, m) => {
                        const prog = Math.min(1, (realNow - m.maintenanceStartedAt) / (m.maintenanceDurationMs || 15000));
                        return s + prog;
                    }, 0) / inMaintMembers.length * 100)
                    : 0;

                return (
                    <div
                        key={group.id}
                        className={styles.card}
                        style={{
                            padding: '0', overflow: 'hidden',
                            borderLeft: `6px solid ${hasMaintenance ? '#f0c040' : (group.status === 'READY' ? '#2ecc71' : (group.status === 'MAINTENANCE' ? '#f1c40f' : '#e74c3c'))}`,
                            position: 'relative',
                        }}
                    >
                        {/* Pasek postępu nad całą grupą */}
                        {hasMaintenance && (
                            <div style={{ background: '#0d1f0d', borderBottom: '1px solid #2ecc71', padding: '4px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', color: '#f0c040', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>🔧</span> W KONSERWACJI: {inMaintMembers.length}/{members.length} szt. ({avgProgress}%)
                                </span>
                                <span style={{ fontSize: '10px', color: '#8aab8a', fontFamily: 'Share Tech Mono, monospace' }}>
                                    Skład wyłączony z tras pasażerskich
                                </span>
                            </div>
                        )}
                        {hasMaintenance && (
                            <div style={{ height: '4px', width: '100%', background: '#0a1a0a' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${avgProgress}%`,
                                    background: 'linear-gradient(90deg, #f0c040, #2ecc71)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        )}

                        {/* Nagłówek Grupy */}
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
                                    {hasMaintenance ? (
                                        <span className={`${styles.badge} ${styles.badgeService}`}>🔧 Konserwacja</span>
                                    ) : (
                                        <>
                                            {group.status === 'READY' && <span className={`${styles.badge} ${styles.badgeReady}`}>Operacyjny</span>}
                                            {group.status === 'MAINTENANCE' && <span className={`${styles.badge} ${styles.badgeService}`}>Serwis</span>}
                                            {group.status === 'OVERHAUL' && <span className={`${styles.badge} ${styles.badgeRepair}`}>Remont</span>}
                                        </>
                                    )}

                                    {group.isGroup && members.length > 0 && (
                                        hasMaintenance ? (
                                            <span style={{
                                                padding: '6px 12px', fontSize: '10px', fontWeight: 700,
                                                color: '#f0c040', background: 'rgba(240,192,64,0.1)',
                                                borderRadius: '4px', border: '1px solid rgba(240,192,64,0.3)',
                                                marginLeft: '10px'
                                            }}>
                                                🛠 Trwa Serwis ({inMaintMembers.length}/{members.length})
                                            </span>
                                        ) : (
                                            <button
                                                className={styles.saveBtn}
                                                style={{
                                                    padding: '6px 14px', fontSize: '10px', background: 'transparent',
                                                    border: '1px solid #f0c040', color: '#f0c040', margin: 0,
                                                    textTransform: 'uppercase', fontWeight: 700, marginLeft: '10px',
                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openConfirmModal(group.name, members);
                                                }}
                                            >
                                                <span style={{ fontSize: '14px' }}>🛠</span> Konserwacja Składu
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Lista elementów grupy */}
                        {isExpanded && (
                            <div style={{ padding: '5px 15px 15px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,10,0,0.1)' }}>
                                {members.map(m => {
                                    const inMaint = m.maintenanceStartedAt && !m.maintenanceComplete;
                                    const prog = inMaint
                                        ? Math.min(1, (realNow - m.maintenanceStartedAt) / (m.maintenanceDurationMs || 15000))
                                        : 0;

                                    return (
                                        <div
                                            key={m.id}
                                            style={{
                                                display: 'flex', flexDirection: 'column', gap: '6px',
                                                padding: '10px 15px', background: inMaint ? 'rgba(46,204,113,0.05)' : 'rgba(13,26,13,0.3)',
                                                borderRadius: '4px', border: `1px solid ${inMaint ? '#2ecc71' : '#2a4a2a'}`
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#eee' }}>{m.name}</span>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '3px' }}>
                                                        <span style={{ fontSize: '11px', background: '#060f06', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', color: m.ageYears != null ? '#f0c040' : '#555' }}>
                                                            {m.ageYears != null ? `${m.ageYears} lat` : '15.0 lat'}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: '#8aab8a' }}>| Typ: {m.type}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: inMaint ? '#2ecc71' : (m.condition > 80 ? '#2ecc71' : (m.condition > 65 ? '#f1c40f' : '#e74c3c')) }}>
                                                        {inMaint ? `${Math.round(prog * 100)}%` : `${m.condition}%`}
                                                    </span>
                                                    {inMaint ? (
                                                        <span style={{ fontSize: '11px', color: '#2ecc71', fontWeight: 700, padding: '4px 8px', background: 'rgba(46,204,113,0.1)', borderRadius: 3, border: '1px solid rgba(46,204,113,0.3)' }}>
                                                            🔧 W SERWISIE
                                                        </span>
                                                    ) : (
                                                        <button
                                                            className={styles.saveBtn}
                                                            style={{ padding: '5px 12px', fontSize: '10px', background: '#0a150a', border: '1px solid #2a4a2a', color: '#8aab8a', margin: 0, textTransform: 'uppercase' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openConfirmModal(m.name, [m]);
                                                            }}
                                                        >
                                                            Konserwacja
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* PASEK POSTĘPU DLA JEDNEGO ELEMENTU */}
                                            {inMaint && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8aab8a' }}>
                                                        <span>Trwa konserwacja...</span>
                                                        <strong style={{ color: '#2ecc71' }}>{Math.round(prog * 100)}%</strong>
                                                    </div>
                                                    <div style={{ height: 4, background: '#0a1a0a', borderRadius: 2, overflow: 'hidden' }}>
                                                        <div style={{ width: `${Math.round(prog * 100)}%`, height: '100%', background: '#2ecc71', transition: 'width 0.3s ease' }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>}
        </>
    );
}
