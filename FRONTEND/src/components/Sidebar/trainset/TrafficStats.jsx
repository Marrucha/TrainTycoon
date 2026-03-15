import styles from '../RoutePanel.module.css'

export default function TrafficStats({
  totalDailyPassengers, totalTransferred, avgOccupancy
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>STATYSTYKI RUCHU</div>
      <div className={styles.stats}>
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
    </section>
  )
}
