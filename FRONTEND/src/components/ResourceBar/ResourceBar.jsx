import { useGame } from '../../context/GameContext'
import styles from './ResourceBar.module.css'

export default function ResourceBar() {
  const { budget, trainsSets, activeTrainsCount, lastDailyReport } = useGame()
  const przychod = lastDailyReport?.przychod ?? null
  const koszty   = lastDailyReport?.koszty   ?? null
  const netto    = lastDailyReport?.netto     ?? null

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

      <div className={styles.dailyTable}>
        <div className={styles.dailyRow}>
          <span className={styles.dailyLabel}>PRZYCHÓD</span>
          <span className={`${styles.dailyValue} ${styles.revenue}`}>
            {przychod !== null ? `+${przychod.toLocaleString('pl-PL')}` : '—'} PLN
          </span>
        </div>
        <div className={styles.dailyRow}>
          <span className={styles.dailyLabel}>KOSZTY</span>
          <span className={`${styles.dailyValue} ${styles.cost}`}>
            {koszty !== null ? `-${koszty.toLocaleString('pl-PL')}` : '—'} PLN
          </span>
        </div>
        <div className={`${styles.dailyRow} ${styles.dailyRowTotal}`}>
          <span className={styles.dailyLabel}>WYNIK / DOBA</span>
          <span className={`${styles.dailyValue} ${netto !== null ? (netto >= 0 ? styles.revenue : styles.cost) : ''}`}>
            {netto !== null ? `${netto >= 0 ? '+' : ''}${netto.toLocaleString('pl-PL')}` : '—'} PLN
          </span>
        </div>
      </div>
    </div>
  )
}
