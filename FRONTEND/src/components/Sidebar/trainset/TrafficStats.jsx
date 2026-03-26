import { useState } from 'react'
import styles from '../RoutePanel.module.css'

export default function TrafficStats({
  totalDailyPassengers, totalTransferred, avgOccupancy,
  gapowiczeRate, avgInspectionIndex, totalFineRevenue, totalWarsRevenue
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>STATYSTYKI RUCHU</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!open && totalTransferred !== null && (
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#a0c0a0' }}>
              {totalTransferred.toLocaleString('pl-PL')} os.
            </span>
          )}
          <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
        </div>
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
            <span className={styles.statValue}>
              {gapowiczeRate != null ? `${Math.round(gapowiczeRate * 100)}%` : '— (brak danych)'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Pokrycie kontrolą</span>
            <span className={styles.statValue}>
              {avgInspectionIndex != null ? `${avgInspectionIndex}%` : '— (brak danych)'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Zebrane kary / dobę</span>
            <span className={styles.statValue} style={{ color: totalFineRevenue ? '#4fc3f7' : undefined }}>
              {totalFineRevenue != null ? `${totalFineRevenue.toLocaleString('pl-PL')} PLN` : '— (brak danych)'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Wars / dobę</span>
            <span className={styles.statValue} style={{ color: totalWarsRevenue ? '#4fc3f7' : undefined }}>
              {totalWarsRevenue != null ? `${totalWarsRevenue.toLocaleString('pl-PL')} PLN` : '— (brak danych)'}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
