import { useState, useMemo } from 'react'
import { useGame } from '../../context/GameContext'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'
import { calcCompositionSpeed, calcTotalDelay } from '../../utils/trainSpeed'
import { findShortestPath } from '../../utils/dijkstra'
import styles from './TrainComposer.module.css'

export default function TrainComposer({ onCancel, editTrainSet = null }) {
    const { trains, trainsSets, routes, gameConstants } = useGame()

    const [trainName, setTrainName] = useState(editTrainSet?.name ?? 'Nowy Skład')
    const [composition, setComposition] = useState(() => {
        if (!editTrainSet?.trainIds) return []
        return editTrainSet.trainIds.map(id => trains.find(t => t.id === id)).filter(Boolean)
    })
    const [saving, setSaving] = useState(false)

    const isEditing = !!editTrainSet

    // Dostępne wagony: wolne + te już w edytowanym składzie
    const availableParts = useMemo(() => {
        const editingIds = new Set(editTrainSet?.trainIds ?? [])
        const assignedIds = new Set()
        trainsSets.forEach(ts => {
            if (ts.trainIds && ts.id !== editTrainSet?.id) {
                ts.trainIds.forEach(id => assignedIds.add(id))
            }
        })
        return trains.filter(t => !assignedIds.has(t.id) || editingIds.has(t.id))
    }, [trains, trainsSets, editTrainSet])

    const unassignedParts = availableParts.filter(p => !composition.find(c => c.id === p.id))

    // Handle Drag & Drop
    const handleDragStart = (e, part) => {
        e.dataTransfer.setData('partId', part.id)
    }

    const handleDropOnBoard = (e) => {
        e.preventDefault()
        const partId = e.dataTransfer.getData('partId')
        if (partId) {
            const partObj = trains.find(t => t.id === partId)
            if (partObj && !composition.find(c => c.id === partId)) {
                setComposition(prev => [...prev, partObj])
            }
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
    }

    const handleRemovePart = (id) => {
        setComposition(prev => prev.filter(c => c.id !== id))
    }

    // Wyliczanie statystyk
    const minComponentSpeed = composition.length > 0 ? Math.min(...composition.map(c => c.speed || 100000)) : 0
    const locoMaxSpeed = composition.length > 0 ? Math.max(...composition.map(c => c.speed || 0)) : 0
    const compositionSpeed = composition.length > 0
        ? calcCompositionSpeed(locoMaxSpeed, composition.length, minComponentSpeed === 100000 ? locoMaxSpeed : minComponentSpeed)
        : 0
    const totalSeats = composition.reduce((sum, c) => sum + (c.seats || 0), 0)
    const maxCostPerKm = composition.reduce((sum, c) => sum + (c.costPerKm || 0), 0)

    // Ostrzeżenie o zmianie prędkości względem zapisanego rozkładu
    const speedWarning = useMemo(() => {
        if (!isEditing || !editTrainSet?.scheduleCompositionSpeed || !editTrainSet?.routeStops || composition.length === 0) return null
        const oldSpeed = editTrainSet.scheduleCompositionSpeed
        if (compositionSpeed >= oldSpeed) return null
        const stops = editTrainSet.routeStops
        const allEdges = []
        for (let i = 0; i < stops.length - 1; i++) {
            const seg = findShortestPath(routes, stops[i], stops[i + 1], 'fastest')
            if (seg) allEdges.push(...seg.edges)
        }
        const delay = calcTotalDelay(allEdges, oldSpeed, compositionSpeed)
        if (delay <= 0) return null
        return { delay, block: delay > 50 }
    }, [isEditing, editTrainSet, compositionSpeed, routes, composition.length])

    const snakeRows = useMemo(() => {
        const rows = [];
        let i = 0;
        let isLtoR = true;
        let expectsConnector = false;

        while (i < composition.length) {
            if (expectsConnector) {
                // Pojedynczy łącznik "na zakręcie" weza
                rows.push({
                    items: [composition[i]],
                    style: isLtoR ? 'connectorRight' : 'connectorLeft'
                });
                i += 1;
                expectsConnector = false;
                isLtoR = !isLtoR; // Odwrocenie na nowy pas weza
            } else {
                // Pelny ciag (do 5 wagonow)
                const chunk = composition.slice(i, i + 5);
                rows.push({
                    items: chunk,
                    style: isLtoR ? 'fullLtr' : 'fullRtl'
                });
                i += chunk.length;
                if (chunk.length === 5) {
                    expectsConnector = true; // Jesli pelen rzad 5 szt., to wyzekuje weza
                }
            }
        }
        return rows;
    }, [composition])

    const handleSave = async () => {
        if (composition.length === 0) return alert('Wklej najpierw chociaż jedną maszynę na planszę!')

        setSaving(true)

        try {
            const next3AM = new Date()
            next3AM.setHours(3, 0, 0, 0)
            if (next3AM.getTime() <= Date.now()) {
                next3AM.setDate(next3AM.getDate() + 1)
            }
            let dispatchMs = null
            if (gameConstants?.REAL_START_TIME_MS) {
                dispatchMs = gameConstants.GAME_START_TIME_MS + (next3AM.getTime() - gameConstants.REAL_START_TIME_MS) * (gameConstants.TIME_MULTIPLIER || 30)
            } else {
                dispatchMs = next3AM.getTime()
            }

            if (isEditing) {
                await updateDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, editTrainSet.id), {
                    name: trainName,
                    type: composition[0]?.type || 'Zwykły',
                    trainIds: composition.map(c => c.id),
                    maxSpeed: minComponentSpeed === 100000 ? 0 : minComponentSpeed,
                    locoMaxSpeed,
                    totalSeats,
                    totalCostPerKm: maxCostPerKm,
                    speedMismatchBlock: speedWarning?.block ?? false,
                })
            } else {
                const setId = `trainset-${Date.now()}`
                await setDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, setId), {
                    id: setId,
                    name: trainName,
                    createdAt: new Date().toISOString(),
                    dispatchDate: dispatchMs,
                    type: composition[0]?.type || 'Zwykły',
                    trainIds: composition.map(c => c.id),
                    maxSpeed: minComponentSpeed === 100000 ? 0 : minComponentSpeed,
                    locoMaxSpeed,
                    totalSeats,
                    totalCostPerKm: maxCostPerKm,
                })
            }
            onCancel()
        } catch (e) {
            console.error(e)
            alert('Wystąpił błąd podczas zapisywania składu!')
            setSaving(false)
        }
    }

    return (
        <div className={styles.composerWrapper}>
            <div className={styles.composerHeader}>
                <div className={styles.headerTitle}>
                    <h3>{isEditing ? 'Edytuj Skład' : 'Kreator Składu'}</h3>
                    <input
                        type="text"
                        value={trainName}
                        onChange={(e) => setTrainName(e.target.value)}
                        className={styles.nameInput}
                        placeholder="Nazwij swój pociąg..."
                    />
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.cancelBtn} onClick={onCancel} disabled={saving}>Anuluj</button>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving || speedWarning?.block}>{isEditing ? 'Zapisz Zmiany' : 'Zapisz Skład'}</button>
                </div>
            </div>

            <div className={styles.composerContent}>

                {/* LEWA STRONA: Obszar zrzutu poziomego */}
                <div className={styles.boardArea}>
                    <div className={styles.statsBar}>
                        <div>Prędkość składu: <strong>{compositionSpeed} km/h</strong></div>
                        <div>Konserwacja: <strong>{maxCostPerKm} PLN/km</strong></div>
                        <div>Pojemność SUMA: <strong>{totalSeats} os.</strong></div>
                    </div>
                    {speedWarning && (
                        <div style={{
                            margin: '6px 0', padding: '8px 10px', borderRadius: 6,
                            background: speedWarning.block ? 'rgba(231,76,60,0.15)' : 'rgba(243,156,18,0.15)',
                            border: `1px solid ${speedWarning.block ? '#e74c3c' : '#f39c12'}`,
                            fontSize: 11, color: speedWarning.block ? '#e74c3c' : '#f39c12'
                        }}>
                            {speedWarning.block
                                ? `Uwaga: dodanie wagonu spowoduje opóźnienie +${speedWarning.delay} min — przekracza 50 min. Zaktualizuj rozkład jazdy przed zapisem.`
                                : `Uwaga: dodanie wagonu może spowodować opóźnienie do +${speedWarning.delay} min. Rozważ aktualizację rozkładu.`
                            }
                        </div>
                    )}

                    <div
                        className={styles.dropZone}
                        onDrop={handleDropOnBoard}
                        onDragOver={handleDragOver}
                    >
                        {composition.length === 0 ? (
                            <div className={styles.dropPlaceholder}>Przeciągnij tutaj Lokomotywę z listy obok</div>
                        ) : (
                            <div className={styles.trainAssembly}>
                                {snakeRows.map((row, rIndex) => (
                                    <div key={rIndex} className={`${styles.snakeRow} ${styles[row.style]}`}>
                                        {row.items.map((part) => (
                                            <div key={part.id} className={styles.assemblyPart} onClick={() => handleRemovePart(part.id)}>
                                                <div className={styles.removeHint}>[x] Usuń</div>
                                                {part.imageUrl2 || part.imageUrl ? (
                                                    <div className={styles.imgWrap}>
                                                        <img src={part.imageUrl2 || part.imageUrl} alt="Pojazd" />
                                                    </div>
                                                ) : (
                                                    <div className={styles.placeholderBox}>
                                                        <span>📷</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* PRAWA STRONA: Pionowa lista wyboru zasobow */}
                <div className={styles.inventoryArea}>
                    <h4>Stocznia (Wolne wagony)</h4>
                    <div className={styles.inventoryList}>
                        {unassignedParts.length === 0 ? (
                            <p className={styles.emptyInv}>Brak wolnych maszyn do użycia. Odczep z innych składów lub kup nowe.</p>
                        ) : (
                            unassignedParts.map(part => (
                                <div
                                    key={part.id}
                                    className={styles.inventoryItem}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, part)}
                                >
                                    <div className={styles.itemImgWrap}>
                                        {part.imageUrl ? (
                                            <img src={part.imageUrl} alt={part.name} />
                                        ) : (
                                            <div className={styles.itemImgPlaceholder}>📷</div>
                                        )}
                                    </div>
                                    <div className={styles.itemInfo}>
                                        <span className={styles.itemName}>{part.name}</span>
                                        <span className={styles.itemType}>{part.seats > 0 ? 'WAGON' : 'LOKOMOTYWA'}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
