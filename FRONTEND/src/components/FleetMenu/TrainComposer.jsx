import { useState, useMemo } from 'react'
import { useGame } from '../../context/GameContext'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'
import styles from './TrainComposer.module.css'

export default function TrainComposer({ onCancel, editTrainSet = null }) {
    const { trains, trainsSets } = useGame()

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
    const currentMaxSpeed = composition.length > 0 ? Math.min(...composition.map(c => c.speed || 100000)) : 0
    const totalSeats = composition.reduce((sum, c) => sum + (c.seats || 0), 0)
    const maxCostPerKm = composition.reduce((sum, c) => sum + (c.costPerKm || 0), 0)

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
            if (isEditing) {
                await updateDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, editTrainSet.id), {
                    name: trainName,
                    type: composition[0]?.type || 'Zwykły',
                    trainIds: composition.map(c => c.id),
                    maxSpeed: currentMaxSpeed === 100000 ? 0 : currentMaxSpeed,
                    totalSeats,
                    totalCostPerKm: maxCostPerKm,
                })
            } else {
                const setId = `trainset-${Date.now()}`
                await setDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, setId), {
                    id: setId,
                    name: trainName,
                    type: composition[0]?.type || 'Zwykły',
                    trainIds: composition.map(c => c.id),
                    maxSpeed: currentMaxSpeed === 100000 ? 0 : currentMaxSpeed,
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
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{isEditing ? 'Zapisz Zmiany' : 'Zapisz Skład'}</button>
                </div>
            </div>

            <div className={styles.composerContent}>

                {/* LEWA STRONA: Obszar zrzutu poziomego */}
                <div className={styles.boardArea}>
                    <div className={styles.statsBar}>
                        <div>Prędkość MAX: <strong>{currentMaxSpeed === 100000 ? 0 : currentMaxSpeed} km/h</strong></div>
                        <div>Konserwacja: <strong>{maxCostPerKm} PLN/km</strong></div>
                        <div>Pojemność SUMA: <strong>{totalSeats} os.</strong></div>
                    </div>

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
