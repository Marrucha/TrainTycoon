import styles from '../RoutePanel.module.css'

export default function PositionSection({ positionState }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>AKTUALNA POZYCJA</div>
      <div className={styles.stats}>
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
    </section>
  )
}
