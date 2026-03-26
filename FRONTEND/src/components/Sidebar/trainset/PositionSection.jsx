import { useState } from 'react'
import styles from '../RoutePanel.module.css'

export default function PositionSection({ positionState }) {
  const [open, setOpen] = useState(true)
  return (
    <section className={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>AKTUALNA POZYCJA</span>
        <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className={styles.stats} style={{ marginTop: 10 }}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>{positionState ? positionState.label1 : 'Status'}</span>
            <span className={styles.statValue} style={{ color: positionState ? '#fff' : '#666' }}>
              {positionState ? positionState.value1 : '— (brak danych)'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>{positionState ? positionState.label2 : 'Godzina'}</span>
            <span className={styles.statValue} style={{ color: positionState ? '#f0c040' : '#666' }}>
              {positionState ? positionState.value2 : '— (brak danych)'}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
