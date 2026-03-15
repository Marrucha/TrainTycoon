import { haversineKm } from '../../../data/demand'
import styles from '../RoutePanel.module.css'

export default function RevenueSection({ byKurs, cities, totalCostPerKm, totalDailyRevenue }) {
  let dailyKm = 0
  Object.values(byKurs).forEach(stops => {
    for (let i = 0; i < stops.length - 1; i++) {
      const a = cities?.find(c => c.id === stops[i].miasto || c.name === stops[i].miasto)
      const b = cities?.find(c => c.id === stops[i+1].miasto || c.name === stops[i+1].miasto)
      if (a && b) dailyKm += haversineKm(a.lat, a.lon, b.lat, b.lon)
    }
  })
  dailyKm = Math.round(dailyKm)

  const dailyCost = totalCostPerKm && dailyKm > 0 ? Math.round(totalCostPerKm * dailyKm) : null
  const netBalance = (totalDailyRevenue > 0 || dailyCost !== null)
    ? totalDailyRevenue - (dailyCost ?? 0)
    : null

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>PRZYCHODY I KOSZTY</div>
      <div className={styles.stats}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Dzienny przychód</span>
          <span className={styles.statValue} style={{ color: totalDailyRevenue > 0 ? '#4fc3f7' : undefined, fontWeight: 'bold' }}>
            {totalDailyRevenue > 0 ? `${totalDailyRevenue.toLocaleString('pl-PL')} PLN` : '— (brak danych)'}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Km / dobę</span>
          <span className={styles.statValue}>{dailyKm > 0 ? `${dailyKm.toLocaleString('pl-PL')} km` : '—'}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Opłaty torowe / dobę</span>
          <span className={styles.statValue} style={{ color: dailyCost !== null ? '#f0a040' : undefined }}>
            {dailyCost !== null ? `${dailyCost.toLocaleString('pl-PL')} PLN` : '— (brak danych)'}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Wynik netto</span>
          <span className={styles.statValue} style={{ color: netBalance !== null ? (netBalance >= 0 ? '#4caf50' : '#e74c3c') : undefined, fontWeight: 'bold' }}>
            {netBalance !== null ? `${netBalance >= 0 ? '+' : ''}${netBalance.toLocaleString('pl-PL')} PLN` : '— (brak danych)'}
          </span>
        </div>
      </div>
    </section>
  )
}
