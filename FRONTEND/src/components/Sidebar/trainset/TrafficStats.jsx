import { useState } from 'react'
import styles from '../RoutePanel.module.css'

export default function TrafficStats({
  totalDailyPassengers, totalTransferred, avgOccupancy
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>STATYSTYKI RUCHU</span>
        <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className={styles.stats} style={{ marginTop: 10 }}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Popyt / dobę</span>
            <span className={styles.statValue}>
              {totalDailyPassengers !== null ? `${totalDailyPassengers.toLocaleString('pl-PL')} os.` : '— (brak danych)'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Przewiezieni / dobę</span>
            <span className={styles.statValue}>
              {totalTransferred !== null ? `${totalTransferred.toLocaleString('pl-PL')} os.` : '— (brak danych)'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Śr. obłożenie</span>
            <span className={styles.statValue}>
              {avgOccupancy !== null ? `${avgOccupancy}%` : '— (brak danych)'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Gapowicze</span>
            <span className={styles.statValue}>— (brak danych)</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Kontrole biletów</span>
            <span className={styles.statValue}>— (brak danych)</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Zebrane kary</span>
            <span className={styles.statValue}>— (brak danych)</span>
          </div>
        </div>
      )}
    </section>
  )
}
