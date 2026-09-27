import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../../context/GameContext'
import styles from '../RoutePanel.module.css'

/**
 * Zwraca progress konserwacji (0–1) dla wagonu.
 * Gdy progress >= 1 wywołuje onComplete.
 */
function useMaintenanceProgress(wagon, onComplete) {
  const [progress, setProgress] = useState(() => calcProgress(wagon))
  const completedRef = useRef(false)

  function calcProgress(w) {
    if (!w?.maintenanceStartedAt || w.maintenanceComplete) return w?.maintenanceComplete ? 1 : null
    const elapsed = Date.now() - w.maintenanceStartedAt
    const duration = w.maintenanceDurationMs || 1
    return Math.min(1, elapsed / duration)
  }

  useEffect(() => {
    completedRef.current = false
    setProgress(calcProgress(wagon))
  }, [wagon?.maintenanceStartedAt, wagon?.maintenanceDurationMs, wagon?.maintenanceComplete])

  useEffect(() => {
    if (progress === null || progress >= 1) return
    const id = setInterval(() => {
      const p = calcProgress(wagon)
      setProgress(p)
      if (p >= 1 && !completedRef.current) {
        completedRef.current = true
        onComplete?.()
      }
    }, 500)
    return () => clearInterval(id)
  }, [wagon?.maintenanceStartedAt, wagon?.maintenanceDurationMs])

  return progress
}

/** Pasek postępu jednego wagonu */
function WagonMaintenanceBar({ wagon, onStart, onComplete }) {
  const progress = useMaintenanceProgress(wagon, () => onComplete(wagon.id))
  const condition = wagon.condition ?? 1.0
  const conditionPct = Math.round(condition * 100)
  const isInMaintenance = wagon.maintenanceStartedAt && !wagon.maintenanceComplete && progress !== null && progress < 1
  const isDone = wagon.maintenanceComplete || progress >= 1

  const condColor = condition >= 0.8 ? '#2ecc71' : condition >= 0.5 ? '#f0c040' : '#e74c3c'

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#8aab8a', fontFamily: 'Share Tech Mono, monospace' }}>
          {wagon.name || wagon.id}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: condColor, fontWeight: 700 }}>
            {conditionPct}%
          </span>
          {!isInMaintenance && !isDone && (
            <button
              onClick={() => onStart(wagon.id, condition)}
              style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                background: 'rgba(240,192,64,0.1)', color: '#f0c040',
                border: '1px solid rgba(240,192,64,0.3)', fontWeight: 700,
                letterSpacing: 1, textTransform: 'uppercase',
              }}
            >
              Konserwacja
            </button>
          )}
          {isDone && !isInMaintenance && (
            <span style={{ fontSize: 9, color: '#2ecc71', fontWeight: 700, letterSpacing: 1 }}>✓ OK</span>
          )}
        </div>
      </div>

      {/* Pasek stanu technicznego */}
      <div style={{ height: 4, background: '#0d1f0d', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${conditionPct}%`,
          background: condColor,
          transition: 'width 0.3s ease',
          borderRadius: 2,
        }} />
      </div>

      {/* Pasek postępu konserwacji */}
      {isInMaintenance && (
        <div style={{ marginTop: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: '#6a9a6a', letterSpacing: 1 }}>🔧 W KONSERWACJI</span>
            <span style={{ fontSize: 9, color: '#6a9a6a' }}>{Math.round((progress ?? 0) * 100)}%</span>
          </div>
          <div style={{ height: 4, background: '#0d1f0d', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((progress ?? 0) * 100)}%`,
              background: 'linear-gradient(90deg, #1a6a3a, #2ecc71)',
              borderRadius: 2,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function MaintenanceSection({ trainSet, wagons }) {
  const { startMaintenance, completeMaintenance } = useGame()
  const [open, setOpen] = useState(false)

  if (!wagons || wagons.length === 0) return null

  // Średni stan techniczny składu
  const conditions = wagons.map(w => w.condition ?? 1.0)
  const avgCondition = conditions.reduce((s, c) => s + c, 0) / conditions.length
  const avgPct = Math.round(avgCondition * 100)

  // Ile wagonów w konserwacji
  const inMaintenance = wagons.filter(w => w.maintenanceStartedAt && !w.maintenanceComplete).length
  const needsMaintenance = wagons.filter(w => (w.condition ?? 1.0) < 1.0 && !w.maintenanceStartedAt).length

  const avgColor = avgCondition >= 0.8 ? '#2ecc71' : avgCondition >= 0.5 ? '#f0c040' : '#e74c3c'

  const handleStartAll = () => {
    wagons.forEach(w => {
      const cond = w.condition ?? 1.0
      if (cond < 1.0 && !w.maintenanceStartedAt) {
        startMaintenance(w.id, cond)
      }
    })
  }

  return (
    <section className={styles.section}>
      {/* Nagłówek — pasek sumaryczny */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 6 }}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>
          STAN TECHNICZNY
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {inMaintenance > 0 && (
            <span style={{ fontSize: 9, color: '#2ecc71', letterSpacing: 1, fontWeight: 700 }}>
              🔧 {inMaintenance}/{wagons.length}
            </span>
          )}
          <span style={{ fontSize: 10, color: avgColor, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace' }}>
            {avgPct}%
          </span>
          <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
        </div>
      </div>

      {/* Sumaryczny pasek stanu */}
      <div style={{ height: 5, background: '#0d1f0d', borderRadius: 3, overflow: 'hidden', marginBottom: open ? 10 : 0 }}>
        <div style={{
          height: '100%', width: `${avgPct}%`,
          background: `linear-gradient(90deg, ${avgColor}88, ${avgColor})`,
          borderRadius: 3,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Rozwinięta lista wagonów */}
      {open && (
        <div style={{ marginTop: 8 }}>
          {needsMaintenance > 0 && (
            <button
              onClick={handleStartAll}
              style={{
                width: '100%', marginBottom: 10, padding: '5px 0',
                background: 'rgba(240,192,64,0.08)', color: '#f0c040',
                border: '1px solid rgba(240,192,64,0.25)', borderRadius: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              🔧 Konserwacja wszystkich ({needsMaintenance})
            </button>
          )}
          {wagons.map(wagon => (
            <WagonMaintenanceBar
              key={wagon.id}
              wagon={wagon}
              onStart={(id, cond) => startMaintenance(id, cond)}
              onComplete={(id) => completeMaintenance(id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
