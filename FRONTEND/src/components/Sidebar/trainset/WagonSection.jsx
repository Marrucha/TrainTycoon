import styles from '../RoutePanel.module.css'

export default function WagonSection({ wagonGroups, maxSpeed, totalCostPerKm }) {
  const hasWagons = Object.keys(wagonGroups).length > 0

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>SKŁAD WAGONÓW</div>
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
    </section>
  )
}
