import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import s from './Exchange.module.css'

export default function ExchangePriceChart({ ownerUid, width = 80, height = 32 }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!ownerUid) return
    const q = query(
      collection(db, `exchange/${ownerUid}/priceHistory`),
      orderBy('date', 'desc'),
      limit(14)
    )
    const unsub = onSnapshot(q, (snap) => {
      const pts = snap.docs.map(d => d.data().closePrice).filter(Boolean).reverse()
      setHistory(pts)
    })
    return unsub
  }, [ownerUid])

  if (history.length < 2) {
    return <svg width={width} height={height} className={s.sparkline} />
  }

  const min = Math.min(...history)
  const max = Math.max(...history)
  const range = max - min || 1

  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })

  const lastTwo = history.slice(-2)
  const color = lastTwo[1] >= lastTwo[0] ? '#4CAF50' : '#e74c3c'

  return (
    <svg width={width} height={height} className={s.sparkline}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
