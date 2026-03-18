import { useGame } from '../../context/GameContext'
import styles from './ResourceBar.module.css'

export default function ResourceBar() {
  const { budget, trainsSets, activeTrainsCount, dailyRevenue } = useGame()

  return (
    <div className={styles.bar}>
      <div className={styles.stat}>
        <span className={styles.label}>BUDŻET</span>
        <span className={styles.value}>
          {budget.toLocaleString('pl-PL')}
          <span className={styles.unit}> PLN</span>
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.stat}>
        <span className={styles.label}>TABOR</span>
        <span className={styles.value}>
          {activeTrainsCount}
          <span className={styles.unit}> / {trainsSets?.length ?? 0}</span>
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.stat}>
        <span className={styles.label}>PRZYCHÓD / DOBA</span>
        <span className={`${styles.value} ${styles.revenue}`}>
          +{dailyRevenue.toLocaleString('pl-PL')}
          <span className={styles.unit}> PLN</span>
        </span>
      </div>
    </div>
  )
}
