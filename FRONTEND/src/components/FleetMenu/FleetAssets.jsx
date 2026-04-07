import { useState, useMemo } from 'react'
import { useGame } from '../../context/GameContext'
import TrainStore from './TrainStore'
import styles from './FleetMenu.module.css'

const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

const SORT_COLS = [
    { key: 'name',        label: 'Nazwa'             },
    { key: 'type',        label: 'Typ'               },
    { key: 'purchasedAt', label: 'Data wejścia'      },
    { key: 'condition',   label: 'Sprawność'         },
    { key: 'speed',       label: 'Prędkość'          },
    { key: 'seats',       label: 'Fotele'            },
    { key: 'costPerKm',   label: 'Kons./km'          },
]

const calcCondition = (train, nowMs) => {
    const purchaseMs = train.purchasedAt ? new Date(train.purchasedAt).getTime() : null
    const lastOverMs = train.lastOverhaul ? new Date(train.lastOverhaul).getTime() : purchaseMs
    if (lastOverMs == null || nowMs == null) return 100
    const timeSinceOverYears = (nowMs - lastOverMs) / (1000 * 60 * 60 * 24 * 365)
    return Math.round(Math.max(0, 100 - (timeSinceOverYears / 10) * 40))
}

export default function FleetAssets() {
    const { trains, baseTrains, gameDate } = useGame()
    const [isStoreOpen, setIsStoreOpen] = useState(false)
    const [view, setView] = useState('type')
    const [sortCol, setSortCol] = useState('name')
    const [sortDir, setSortDir] = useState('asc')

    const baseMap = useMemo(
        () => Object.fromEntries((baseTrains || []).map(b => [b.id, b])),
        [baseTrains]
    )

    const typeGroups = useMemo(() => Object.values(
        trains.reduce((acc, train) => {
            const key = train.parent_id || train.type || train.name
            if (!acc[key]) {
                const base = baseMap[train.parent_id] || {}
                acc[key] = {
                    key,
                    type: train.type,
                    name: base.name || train.name.replace(/ #\d+$/, ''),
                    imageUrl: train.imageUrl || base.imageUrl,
                    speed: train.speed,
                    seats: train.seats,
                    costPerKm: train.costPerKm,
                    members: [],
                }
            }
            acc[key].members.push(train)
            return acc
        }, {})
    ), [trains, baseMap])

    const nowMs = gameDate ? gameDate.getTime() : null

    const sortedTrains = useMemo(() => {
        const withCondition = trains.map(t => ({ ...t, condition: calcCondition(t, nowMs) }))
        return withCondition.sort((a, b) => {
            let av = a[sortCol] ?? ''
            let bv = b[sortCol] ?? ''
            if (sortCol === 'purchasedAt') {
                av = av ? new Date(av).getTime() : 0
                bv = bv ? new Date(bv).getTime() : 0
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1
            if (av > bv) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    }, [trains, sortCol, sortDir, nowMs])

    const handleSort = (key) => {
        if (key === '_actions') return
        setSortDir(prev => sortCol === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')
        setSortCol(key)
    }

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

            {/* View toggle */}
            <div style={{ display: 'flex', background: '#0a150a', padding: '3px', borderRadius: '6px', border: '1px solid #2a4a2a', marginBottom: 20, alignSelf: 'flex-start', width: 'fit-content' }}>
                {[{ k: 'type', l: 'Po typie' }, { k: 'detail', l: 'Detaliczny' }].map(({ k, l }) => (
                    <button
                        key={k}
                        onClick={() => setView(k)}
                        style={{
                            background: view === k ? '#2a4a2a' : 'transparent',
                            color: view === k ? '#f0c040' : '#8aab8a',
                            border: 'none', borderRadius: 4,
                            padding: '6px 16px', fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1,
                        }}
                    >{l}</button>
                ))}
            </div>

            {/* ── Type view ── */}
            {view === 'type' && (
                <div className={styles.grid}>
                    {typeGroups.map(group => (
                        <div key={group.key} className={styles.card}>
                            {group.imageUrl ? (
                                <div className={styles.imageWrapper}>
                                    <img src={group.imageUrl} alt={group.name} className={styles.trainImage} />
                                </div>
                            ) : (
                                <div className={styles.imagePlaceholder}>
                                    <span className={styles.placeholderIcon}>📷</span>
                                    <small>Brak zdjęcia</small>
                                </div>
                            )}
                            <div className={styles.cardBody}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.headerTitleGroup}>
                                        <span className={styles.typeBadge}>{group.type}</span>
                                        <h3>{group.name}</h3>
                                    </div>
                                    <div className={styles.countBadge}>
                                        Posiadasz: <strong>{group.members.length} szt.</strong>
                                    </div>
                                </div>
                                <div className={styles.stats}>
                                    <div className={styles.stat}>
                                        <span className={styles.label}>Prędkość MAX:</span>
                                        <span className={styles.value}>{group.speed} km/h</span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.label}>Pojemność / Fotele:</span>
                                        <span className={styles.value}>{group.seats} os.</span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.label}>Konserwacja / km:</span>
                                        <span className={styles.value}>{group.costPerKm} PLN</span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.label}>Typ Podzespołu:</span>
                                        <span className={styles.value}>{group.seats > 0 ? 'Wagon / EZT' : 'Lokomotywa'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    <button className={styles.fabBtn} onClick={() => setIsStoreOpen(true)} title="Otwórz Fabrykę Pociągów">+</button>
                    {isStoreOpen && <TrainStore onClose={() => setIsStoreOpen(false)} />}
                </div>
            )}

            {/* ── Detail view ── */}
            {view === 'detail' && (
                <div>
                    {/* Sort controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#6a8a6a', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginRight: 4 }}>Sortuj:</span>
                        {SORT_COLS.map(col => (
                            <button
                                key={col.key}
                                onClick={() => handleSort(col.key)}
                                style={{
                                    background: sortCol === col.key ? '#2a4a2a' : '#0a150a',
                                    color: sortCol === col.key ? '#f0c040' : '#8aab8a',
                                    border: `1px solid ${sortCol === col.key ? '#f0c040' : '#2a4a2a'}`,
                                    borderRadius: 4, padding: '4px 10px', fontSize: 10,
                                    fontWeight: 700, cursor: 'pointer',
                                    textTransform: 'uppercase', letterSpacing: 1,
                                }}
                            >
                                {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                            </button>
                        ))}
                    </div>

                    {/* Cards grid */}
                    <div className={styles.grid}>
                        {sortedTrains.map(t => (
                            <div key={t.id} className={styles.card}>
                                {/* Left: image + buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {t.imageUrl ? (
                                        <div className={styles.imageWrapper}>
                                            <img src={t.imageUrl} alt={t.name} className={styles.trainImage} />
                                        </div>
                                    ) : (
                                        <div className={styles.imagePlaceholder}>
                                            <span className={styles.placeholderIcon}>📷</span>
                                            <small>Brak zdjęcia</small>
                                        </div>
                                    )}
                                    <div className={styles.actions} style={{ marginTop: 0 }}>
                                        <button className={styles.actionBtn}>Sprzedaj</button>
                                        <button className={styles.actionBtnSecondary}>Odłącz</button>
                                    </div>
                                </div>
                                {/* Right: header + stats */}
                                <div className={styles.cardBody}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.headerTitleGroup}>
                                            <span className={styles.typeBadge}>{t.type}</span>
                                            <h3>{t.name}</h3>
                                        </div>
                                    </div>
                                    <div className={styles.stats}>
                                        <div className={styles.stat}>
                                            <span className={styles.label}>Wejście do służby:</span>
                                            <span className={styles.value}>{fmtDate(t.purchasedAt)}</span>
                                        </div>
                                        <div className={styles.stat}>
                                            <span className={styles.label}>Sprawność:</span>
                                            <span className={styles.value} style={{ color: t.condition > 80 ? '#2ecc71' : t.condition > 65 ? '#f1c40f' : '#e74c3c', fontWeight: 700 }}>
                                                {t.condition}%
                                            </span>
                                        </div>
                                        <div className={styles.stat}>
                                            <span className={styles.label}>Prędkość MAX:</span>
                                            <span className={styles.value}>{t.speed} km/h</span>
                                        </div>
                                        <div className={styles.stat}>
                                            <span className={styles.label}>Pojemność / Fotele:</span>
                                            <span className={styles.value}>{t.seats} os.</span>
                                        </div>
                                        <div className={styles.stat}>
                                            <span className={styles.label}>Konserwacja / km:</span>
                                            <span className={styles.value}>{t.costPerKm} PLN</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button className={styles.fabBtn} onClick={() => setIsStoreOpen(true)} title="Otwórz Fabrykę Pociągów">+</button>
                        {isStoreOpen && <TrainStore onClose={() => setIsStoreOpen(false)} />}
                    </div>
                </div>
            )}
        </div>
    )
}
