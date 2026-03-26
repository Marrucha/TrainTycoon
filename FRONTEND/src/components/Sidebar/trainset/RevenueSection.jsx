import { useState } from 'react'
import { haversineKm } from '../../../data/demand'
import styles from '../RoutePanel.module.css'

export default function RevenueSection({ byKurs, cities, totalCostPerKm, totalDailyRevenue }) {
  const [open, setOpen] = useState(false)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>PRZYCHODY I KOSZTY</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!open && netBalance !== null && (
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: netBalance >= 0 ? '#4caf50' : '#e74c3c', fontWeight: 'bold' }}>
              {netBalance >= 0 ? '+' : ''}{netBalance.toLocaleString('pl-PL')} PLN
            </span>
          )}
          <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
        </div>
      </div>
      {open && (
        <div className={styles.stats} style={{ marginTop: 10 }}>
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
      )}
    </section>
  )
}
