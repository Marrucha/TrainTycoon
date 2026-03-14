import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import TrainStore from './TrainStore'
import styles from './FleetMenu.module.css'

export default function FleetAssets() {
    const { trains } = useGame()
    const [isStoreOpen, setIsStoreOpen] = useState(false)

    // Grupowanie taboru po nazwie
    const groupedTrains = Object.values(trains.reduce((acc, train) => {
        if (!acc[train.name]) {
            acc[train.name] = { ...train, count: 1 }
        } else {
            acc[train.name].count += 1
        }
        return acc
    }, {}))

    return (
        <div className={styles.grid}>
            {groupedTrains.map(train => (
                <div key={train.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.headerTitleGroup}>
                            <span className={styles.typeBadge}>{train.type}</span>
                            <h3>{train.name}</h3>
                        </div>
                        <div className={styles.countBadge}>
                            Posiadasz: <strong>{train.count} szt.</strong>
                        </div>
                    </div>

                    {train.imageUrl ? (
                        <div className={styles.imageWrapper}>
                            <img src={train.imageUrl} alt={train.name} className={styles.trainImage} />
                        </div>
                    ) : (
                        <div className={styles.imagePlaceholder}>
                            <span className={styles.placeholderIcon}>📷</span>
                            <small>Brak zdjęcia</small>
                        </div>
                    )}

                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.label}>Prędkość MAX:</span>
                            <span className={styles.value}>{train.speed} km/h</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.label}>Pojemność / Fotele:</span>
                            <span className={styles.value}>{train.seats} os.</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.label}>Konserwacja / km:</span>
                            <span className={styles.value}>{train.costPerKm} PLN</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.label}>Typ Podzespołu:</span>
                            <span className={styles.value}>{train.seats > 0 ? "Wagon / EZT" : "Lokomotywa"}</span>
                        </div>
                    </div>
                    <div className={styles.actions}>
                        <button className={styles.actionBtn}>Sprzedaj</button>
                        <button className={styles.actionBtnSecondary}>Odłącz / Wycofaj</button>
                    </div>
                </div>
            ))}

            <button
                className={styles.fabBtn}
                onClick={() => setIsStoreOpen(true)}
                title="Otwórz Fabrykę Pociągów"
            >
                +
            </button>

            {isStoreOpen && <TrainStore onClose={() => setIsStoreOpen(false)} />}
        </div>
    )
}
