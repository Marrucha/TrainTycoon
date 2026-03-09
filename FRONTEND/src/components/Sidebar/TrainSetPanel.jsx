import { useGame } from '../../context/GameContext'
import styles from './RoutePanel.module.css'

export default function TrainSetPanel() {
  const { selectedTrainSet, selectTrainSet, trains, getCityById, companyName } = useGame()

  if (!selectedTrainSet) return null

  const ts = selectedTrainSet
  const stops = ts.routeStops || []
  const fromCity = getCityById(stops[0])
  const toCity = getCityById(stops[stops.length - 1])
  const viaStops = stops.slice(1, -1).map((id) => getCityById(id)?.name || id)

  const wagons = (ts.trainIds || [])
    .map((id) => trains.find((t) => t.id === id))
    .filter(Boolean)

  // Grupowanie wagonów po typie
  const wagonGroups = wagons.reduce((acc, w) => {
    const key = w.name || w.type || 'Nieznany'
    if (!acc[key]) acc[key] = { count: 0, seats: w.seats || 0 }
    acc[key].count++
    return acc
  }, {})

  // Kursy z rozkładu
  const coursesCount = ts.rozklad?.length
    ? new Set(ts.rozklad.map((s) => s.kurs)).size
    : 0

  // Następne odjazdy z rozkładu (pierwsza stacja każdego kursu)
  const firstStops = []
  if (ts.rozklad?.length) {
    const byKurs = {}
    ts.rozklad.forEach((s) => {
      if (!byKurs[s.kurs]) byKurs[s.kurs] = s
    })
    Object.values(byKurs)
      .sort((a, b) => (a.odjazd || '').localeCompare(b.odjazd || ''))
      .forEach((s) => {
        firstStops.push({ kurs: s.kurs, miasto: s.miasto, odjazd: s.odjazd, kierunek: s.kierunek })
      })
  }

  return (
    <div className={styles.panel}>
      {/* Nagłówek */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => selectTrainSet(ts)}>
          ← wróć
        </button>
        <div className={styles.routeTitle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={styles.trainType}>{companyName || ts.type}</span>
            <span className={styles.cities}>{ts.name}</span>
          </div>
          <span className={styles.meta}>
            {stops.length > 0
              ? `${fromCity?.name || stops[0]} ↔ ${toCity?.name || stops[stops.length - 1]}`
              : 'brak trasy'}
            {viaStops.length > 0 && ` · via: ${viaStops.join(', ')}`}
          </span>
        </div>
      </div>

      <div className={styles.body}>

        {/* Skład wagonów */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>SKŁAD WAGONÓW</div>
          {wagons.length > 0 ? (
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
                  <span className={styles.statValue}>{ts.maxSpeed || '—'} km/h</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Koszt / km</span>
                  <span className={styles.statValue}>
                    {ts.totalCostPerKm ? `${Math.round(ts.totalCostPerKm * 100) / 100} PLN` : '—'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.noTrain}>Brak wagonów w składzie</div>
          )}
        </section>

        {/* Statystyki ruchu */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>STATYSTYKI RUCHU</div>
          <div className={styles.stats}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Pasażerowie / dobę</span>
              <span className={styles.statValue}>— (brak danych)</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Średnie obłożenie</span>
              <span className={styles.statValue}>— (brak danych)</span>
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

        {/* Przychody i koszty */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>PRZYCHODY I KOSZTY</div>
          <div className={styles.stats}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Dzienny przychód</span>
              <span className={styles.statValue}>— (brak danych)</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Wagony restauracyjne</span>
              <span className={styles.statValue}>— (brak danych)</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Opłaty torowe / dobę</span>
              <span className={styles.statValue}>— (brak danych)</span>
            </div>
          </div>
        </section>

        {/* Kursy */}
        <section className={styles.section}>
          <div className={styles.sectionLabelRow}>
            <span className={styles.sectionLabel}>ROZKŁAD KURSÓW</span>
            <span className={styles.depCount}>{coursesCount} kursów / dobę</span>
          </div>
          {firstStops.length > 0 ? (
            <div className={styles.stats}>
              {firstStops.map((s) => (
                <div key={s.kurs} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
                  <span className={styles.depTime} style={{ fontSize: 11, flexShrink: 0 }}>{s.odjazd}</span>
                  <span className={styles.statLabel}>{s.miasto} → {s.kierunek || '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptySchedule}>Brak rozkładu jazdy</div>
          )}
        </section>

        {/* Aktualna pozycja */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>AKTUALNA POZYCJA</div>
          <div className={styles.stats}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Najbliższa stacja</span>
              <span className={styles.statValue}>— (brak danych)</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Szacowany przyjazd</span>
              <span className={styles.statValue}>— (brak danych)</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
