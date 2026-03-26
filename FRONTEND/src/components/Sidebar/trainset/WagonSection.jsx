import { useState } from 'react'
import styles from '../RoutePanel.module.css'

export default function WagonSection({ wagonGroups, maxSpeed, totalCostPerKm }) {
  const [open, setOpen] = useState(false)
  const hasWagons = Object.keys(wagonGroups).length > 0

  return (
    <section className={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>SKŁAD WAGONÓW</span>
        <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {hasWagons ? (
            <>
              <div className={styles.stats}>
                {Object.entries(wagonGroups).map(([type, { count, seats }]) => (
                  <div className={styles.statRow} key={type}>
                    <span className={styles.statLabel}>{type}</span>
                    <span className={styles.statValue}>{count}× · {seats * count} miejsc</span>
                  </div>
                ))}
              </div>
              <div className={styles.stats} style={{ marginTop: 8 }}>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Prędkość maks.</span>
                  <span className={styles.statValue}>{maxSpeed || '—'} km/h</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Koszt / km</span>
                  <span className={styles.statValue}>
                    {totalCostPerKm ? `${Math.round(totalCostPerKm * 100) / 100} PLN` : '—'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.noTrain}>Brak wagonów w składzie</div>
          )}
        </div>
      )}
    </section>
  )
}
