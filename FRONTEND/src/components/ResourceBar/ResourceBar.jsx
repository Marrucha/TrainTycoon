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

      <div className={styles.stat}>
        <span className={styles.label}>PRZYCHÓD / DOBA</span>
        <span className={`${styles.value} ${styles.revenue}`}>
          {przychod !== null ? `+${przychod.toLocaleString('pl-PL')}` : '—'}
          <span className={styles.unit}> PLN</span>
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.stat}>
        <span className={styles.label}>KOSZTY / DOBA</span>
        <span className={`${styles.value} ${styles.cost}`}>
          {koszty !== null ? `-${koszty.toLocaleString('pl-PL')}` : '—'}
          <span className={styles.unit}> PLN</span>
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.stat}>
        <span className={styles.label}>WYNIK / DOBA</span>
        <span className={`${styles.value} ${netto !== null ? (netto >= 0 ? styles.revenue : styles.cost) : ''}`}>
          {netto !== null ? `${netto >= 0 ? '+' : ''}${netto.toLocaleString('pl-PL')}` : '—'}
          <span className={styles.unit}> PLN</span>
        </span>
      </div>
    </div>
  )
}
