import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import styles from './RoutePanel.module.css'

export default function TrainSetPanel() {
  const { selectedTrainSet, selectTrainSet, trains, getCityById, companyName, cities } = useGame()
  const [openKurs, setOpenKurs] = useState(null)

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

  // Popyt dzienny z backendu
  const dailyDemand   = ts.dailyDemand   || null
  const dailyTransfer = ts.dailyTransfer || null

  const totalDailyPassengers = dailyDemand
    ? Object.values(dailyDemand).reduce((sum, d) => sum + (d.total || 0), 0)
    : null
  const totalDailyClass1 = dailyDemand
    ? Object.values(dailyDemand).reduce((sum, d) => sum + (d.class1 || 0), 0)
    : null
  const totalDailyClass2 = dailyDemand
    ? Object.values(dailyDemand).reduce((sum, d) => sum + (d.class2 || 0), 0)
    : null

  const totalTransferred = dailyTransfer
    ? Object.values(dailyTransfer).reduce((sum, d) => sum + (d.total || 0), 0)
    : null
  const totalTransferredC1 = dailyTransfer
    ? Object.values(dailyTransfer).reduce((sum, d) => sum + (d.class1 || 0), 0)
    : null
  const totalTransferredC2 = dailyTransfer
    ? Object.values(dailyTransfer).reduce((sum, d) => sum + (d.class2 || 0), 0)
    : null

  const totalSeats = wagons.reduce((sum, w) => sum + (w.seats || 0), 0)
  const avgOccupancy = (totalTransferred !== null && totalTransferred > 0 && totalSeats > 0 && coursesCount > 0)
    ? Math.round((totalTransferred / (totalSeats * coursesCount)) * 100)
    : null

  // Zbiorcza macierz OD ze wszystkich kursów
  const mergedOD = dailyDemand
    ? Object.values(dailyDemand).reduce((acc, d) => {
        Object.entries(d.od || {}).forEach(([key, val]) => {
          if (!acc[key]) acc[key] = { class1: 0, class2: 0 }
          acc[key].class1 += val.class1 || 0
          acc[key].class2 += val.class2 || 0
        })
        return acc
      }, {})
    : null

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
              <span className={styles.statLabel}>Średnie obłożenie</span>
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

        {/* Macierz popytu OD */}
        {mergedOD && Object.keys(mergedOD).length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>POPYT OD (pary miast / dobę)</div>
            <div className={styles.stats}>
              {Object.entries(mergedOD)
                .sort((a, b) => (b[1].class1 + b[1].class2) - (a[1].class1 + a[1].class2))
                .map(([key, val]) => {
                  const [a, b] = key.split(':')
                  return (
                    <div key={key} className={styles.statRow}>
                      <span className={styles.statLabel} style={{ flex: 1 }}>{a} → {b}</span>
                      <span className={styles.statValue}>{(val.class1 + val.class2).toLocaleString('pl-PL')} os.</span>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

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
              {firstStops.map((s) => {
                const kursDemand   = dailyDemand?.[s.kurs]?.total ?? null
                const kursTransfer = dailyTransfer?.[s.kurs]?.total ?? null
                const kursDisplay  = kursTransfer != null && kursTransfer > 0
                  ? { value: kursTransfer, transferred: true }
                  : kursDemand != null
                    ? { value: Math.min(kursDemand, totalSeats), transferred: false }
                    : null
                const isOpen = openKurs === s.kurs

                // OD breakdown dla tooltipa
                const odDemand   = dailyDemand?.[s.kurs]?.od   ?? {}
                const odTransfer = dailyTransfer?.[s.kurs]?.od ?? {}
                const odKeys     = [...new Set([...Object.keys(odDemand), ...Object.keys(odTransfer)])]
                  .sort((a, b) => {
                    const ta = (odTransfer[a]?.class1 ?? 0) + (odTransfer[a]?.class2 ?? 0)
                    const tb = (odTransfer[b]?.class1 ?? 0) + (odTransfer[b]?.class2 ?? 0)
                    const da = (odDemand[a]?.class1 ?? 0) + (odDemand[a]?.class2 ?? 0)
                    const db = (odDemand[b]?.class1 ?? 0) + (odDemand[b]?.class2 ?? 0)
                    return (tb + db) - (ta + da)
                  })

                return (
                  <div key={s.kurs}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
                      <span className={styles.depTime} style={{ fontSize: 11, flexShrink: 0 }}>{s.odjazd}</span>
                      <span className={styles.statLabel} style={{ flex: 1 }}>{s.miasto} → {s.kierunek || '—'}</span>
                      {kursDisplay && (
                        <span
                          onClick={() => setOpenKurs(isOpen ? null : s.kurs)}
                          style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0, cursor: 'pointer' }}
                        >
                          <span className={styles.depTime} style={{ fontSize: 11, color: kursDisplay.transferred ? '#f0c040' : '#8aab8a' }}>
                            {kursDisplay.value.toLocaleString('pl-PL')}
                          </span>
                          {kursDemand != null && (
                            <span style={{ fontSize: 10, color: '#4a6a4a' }}>
                              / {kursDemand.toLocaleString('pl-PL')} os.
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {isOpen && odKeys.length > 0 && (
                      <div style={{ margin: '2px 0 6px 0', padding: '6px 8px', background: '#0d1f0d', borderLeft: '2px solid #2a4a2a', fontSize: 10 }}>
                        {odKeys.map((key) => {
                          const [fromId, toId] = key.split(':')
                          const fromName = cities?.find(c => c.id === fromId)?.name ?? fromId
                          const toName   = cities?.find(c => c.id === toId)?.name   ?? toId
                          const tr = (odTransfer[key]?.class1 ?? 0) + (odTransfer[key]?.class2 ?? 0)
                          const dm = (odDemand[key]?.class1   ?? 0) + (odDemand[key]?.class2   ?? 0)
                          return (
                            <div key={key} style={{ display: 'flex', gap: 6, padding: '2px 0', borderBottom: '1px solid #1a2a1a' }}>
                              <span style={{ flex: 1, color: '#6a9a6a' }}>{fromName} → {toName}</span>
                              {tr > 0 && <span style={{ color: '#f0c040', minWidth: 30, textAlign: 'right' }}>{tr}</span>}
                              <span style={{ color: '#4a6a4a', minWidth: 30, textAlign: 'right' }}>/ {dm}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
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
