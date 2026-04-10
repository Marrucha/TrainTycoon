import { useState } from 'react'
import styles from '../RoutePanel.module.css'

export default function WagonSection({ wagonGroups, maxSpeed, totalCostPerKm, wagons }) {
  const [open, setOpen] = useState(false)
  const hasWagons = Object.keys(wagonGroups).length > 0

  const totalSeats = (wagons || []).reduce((s, w) => s + (w.seats || 0), 0)
  const seatsC1 = (wagons || []).filter(w => w.class === 1 || w.class === '1').reduce((s, w) => s + (w.seats || 0), 0)
  const seatsC2 = totalSeats - seatsC1

  return (
    <section className={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>SKŁAD WAGONÓW</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!open && hasWagons && (
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#a0c0a0' }}>
              {totalSeats} miejsc
              {(seatsC1 > 0 || seatsC2 > 0) && <span style={{ color: '#6a8a6a' }}> (kl.1:{seatsC1} / kl.2:{seatsC2})</span>}
            </span>
          )}
          <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
        </div>
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
                  <span className={styles.statLabel}>Opłata za tory / km</span>
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
