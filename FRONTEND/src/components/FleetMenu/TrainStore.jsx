import { useState, useEffect, useMemo } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useGame } from '../../context/GameContext'
import styles from './TrainStore.module.css'

export default function TrainStore({ onClose }) {
    const { baseTrains, buyTrain, budget } = useGame()
    const [bgImage, setBgImage] = useState('')
    const [loading, setLoading] = useState(false)
    const [quantities, setQuantities] = useState({}) // trainId → qty

    const getQty = (id) => quantities[id] ?? 1
    const setQty = (id, val) => setQuantities(prev => ({ ...prev, [id]: Math.max(1, val) }))

    useEffect(() => {
        // Obieranie obrazu Lokomotywowni z gameConfig/pictures
        const fetchBg = async () => {
            try {
                const snap = await getDoc(doc(db, 'gameConfig', 'pictures'))
                if (snap.exists() && snap.data().views) {
                    const lkwView = snap.data().views.find(v => v.name === 'Lokomotywownia')
                    if (lkwView && lkwView.url) {
                        setBgImage(lkwView.url)
                    }
                }
            } catch (err) {
                console.error("Failed to load background image:", err)
            }
        }
        fetchBg()
    }, [])

    const handleBuy = async (trainId) => {
        setLoading(true)
        await buyTrain(trainId, getQty(trainId))
        setLoading(false)
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.container} style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none' }}>
                <div className={styles.header}>
                    <h2><span className={styles.icon}>🏭</span> Fabryka Pociągów</h2>
                    <div className={styles.budget}>
                        Saldo: <strong>{budget.toLocaleString()} PLN</strong>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.grid}>
                    {baseTrains.map(train => {
                        const calculatedPrice = train.price || ((train.speed || 100) * (train.seats || 50) * 100)
                        const canAfford = budget >= calculatedPrice

                        const qty = getQty(train.id)
                        const multiplier = Math.max(0.20, Math.pow(0.995, qty))
                        const totalPrice = Math.round(qty * calculatedPrice * multiplier)
                        const discountPct = Math.round((1 - multiplier) * 100)
                        const canAffordTotal = budget >= totalPrice

                        return (
                            <div key={train.id} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.typeBadge}>{train.type}</span>
                                    <h3>{train.name}</h3>
                                </div>

                                {train.imageUrl ? (
                                    <div className={styles.imageWrapper}>
                                        <img src={train.imageUrl} alt={train.name} className={styles.trainImage} />
                                    </div>
                                ) : (
                                    <div className={styles.imagePlaceholder}>
                                        <span className={styles.placeholderIcon}>📷</span>
                                        <small>Brak szkicu</small>
                                    </div>
                                )}

                                <div className={styles.stats}>
                                    <div className={styles.stat}><span className={styles.label}>V-max:</span> <span className={styles.value}>{train.speed} km/h</span></div>
                                    <div className={styles.stat}><span className={styles.label}>Pojemność:</span> <span className={styles.value}>{train.seats} os.</span></div>
                                    <div className={styles.stat}><span className={styles.label}>Koszt Opc.:</span> <span className={styles.value}>{train.costPerKm} PLN/km</span></div>
                                    <div className={styles.stat}><span className={styles.label}>Klasa:</span> <span className={styles.value}>{train.class || 2}</span></div>
                                </div>

                                <div className={styles.footer}>
                                    <div>
                                        <div className={styles.price}>
                                            {totalPrice.toLocaleString()} PLN
                                            {qty > 1 && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6 }}>({calculatedPrice.toLocaleString()} × {qty})</span>}
                                        </div>
                                        {discountPct > 0 && (
                                            <div style={{ fontSize: 11, color: '#2ecc71' }}>rabat {discountPct}%</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input
                                            type="number"
                                            min={1}
                                            value={qty}
                                            onChange={e => setQty(train.id, Math.max(1, parseInt(e.target.value) || 1))}
                                            disabled={loading}
                                            style={{ width: 54, background: '#0f1a0f', border: '1px solid #4a5a1a', color: '#f0c040', borderRadius: 3, padding: '3px 6px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}
                                        />
                                        <button
                                            className={`${styles.buyBtn} ${!canAffordTotal ? styles.disabled : ''}`}
                                            onClick={() => handleBuy(train.id)}
                                            disabled={!canAffordTotal || loading}
                                        >
                                            Kup
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
