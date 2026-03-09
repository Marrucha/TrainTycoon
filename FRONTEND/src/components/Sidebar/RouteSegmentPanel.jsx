import { useState, useEffect } from 'react'
import { useGame } from '../../context/GameContext'
import styles from './RoutePanel.module.css'

export default function RouteSegmentPanel() {
  const { selectedRoute, selectRoute, trainsSets, getCityById, cities } = useGame()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  if (!selectedRoute) return null

  const fromCity = getCityById(selectedRoute.from)
  const toCity = getCityById(selectedRoute.to)

  const resolveCityId = (miasto) =>
    cities.find((c) => c.id === miasto || c.name === miasto)?.id

  // TrainSety które mają oba miasta w routeStops
  const trainSetsOnSegment = trainsSets.filter((ts) => {
    const stops = ts.routeStops || []
    return stops.includes(selectedRoute.from) && stops.includes(selectedRoute.to)
  })

  const timeToMin = (t) => {
    if (!t || t === '—') return -1
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  // Dla każdego kursu: odjazd z from, przyjazd do to, kierunek
  const getPassingTimes = (ts) => {
    if (!ts.rozklad?.length) return []
    const results = []

    const byKurs = {}
    ts.rozklad.forEach((s) => {
      if (!byKurs[s.kurs]) byKurs[s.kurs] = []
      byKurs[s.kurs].push(s)
    })

    // Napraw niespójne dane: odjazd nie może być przed przyjazd w tej samej stacji
    const fix = (stop) => {
      const dep = stop.odjazd, arr = stop.przyjazd
      if (dep && arr && timeToMin(dep) < timeToMin(arr)) return { dep: arr, arr }
      return { dep: dep || arr, arr: arr || dep }
    }

    Object.values(byKurs).forEach((stops) => {
      // Kierunek ustalamy wg pozycji w kursie (indeks), nie porównania czasu
      // — dzięki temu kursy przekraczające północ działają poprawnie
      const fromIdx = stops.findIndex((s) => resolveCityId(s.miasto) === selectedRoute.from)
      const toIdx = stops.findIndex((s) => resolveCityId(s.miasto) === selectedRoute.to)
      if (fromIdx === -1 || toIdx === -1) return
      const fromStop = stops[fromIdx]
      const toStop = stops[toIdx]
      const f = fix(fromStop), t = fix(toStop)

      let odjazd, przyjazd
      if (fromIdx < toIdx) {
        // from → to (kierunek zgodny z kursem)
        odjazd = f.dep
        przyjazd = t.arr
      } else {
        // to → from (kurs odwrotny)
        odjazd = t.dep
        przyjazd = f.arr
      }
      if (!odjazd || !przyjazd) return
      results.push({
        kurs: fromStop.kurs,
        odjazd,
        przyjazd,
        kierunek: fromStop.kierunek || toStop.kierunek || '—',
      })
    })

    return results.sort((a, b) => a.odjazd.localeCompare(b.odjazd))
  }
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const currentlyOnSegment = trainSetsOnSegment.flatMap((ts) =>
    getPassingTimes(ts)
      .filter((t) => {
        const dep = timeToMin(t.odjazd)
        const arr = timeToMin(t.przyjazd)
        if (dep < 0 || arr < 0) return false
        if (dep <= arr) return dep <= currentMin && currentMin <= arr
        // Kurs przekracza północ (np. 23:35 → 00:06)
        return currentMin >= dep || currentMin <= arr
      })
      .map((t) => ({ ts, ...t }))
  )

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => selectRoute(selectedRoute)}>
          ← wróć
        </button>
        <div className={styles.routeTitle}>
          <span className={styles.cities}>
            {fromCity?.name} ↔ {toCity?.name}
          </span>
          <span className={styles.meta}>
            {selectedRoute.distance} km · odcinek
          </span>
        </div>
      </div>

      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.sectionLabelRow}>
            <span className={styles.sectionLabel}>AKTUALNIE NA ODCINKU</span>
            <span className={styles.depCount}>{now.getHours().toString().padStart(2,'0')}:{now.getMinutes().toString().padStart(2,'0')}</span>
          </div>
          {currentlyOnSegment.length === 0 ? (
            <div className={styles.noTrain}>Brak pociągów na odcinku w tej chwili</div>
          ) : (
            currentlyOnSegment.map((item) => (
              <div key={`${item.ts.id}-${item.kurs}`} className={styles.trainCard} style={{ marginBottom: 4 }}>
                <span className={styles.trainType}>{item.ts.type}</span>
                <span className={styles.trainName}>{item.ts.name}</span>
                <span className={styles.depTime} style={{ marginLeft: 'auto', fontSize: 11 }}>{item.odjazd}→{item.przyjazd}</span>
              </div>
            ))
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabelRow}>
            <span className={styles.sectionLabel}>POCIĄGI NA ODCINKU</span>
            <span className={styles.depCount}>{trainSetsOnSegment.length} składów</span>
          </div>

          {trainSetsOnSegment.length === 0 && (
            <div className={styles.noTrain}>Brak pociągów na tym odcinku</div>
          )}

          {trainSetsOnSegment.map((ts) => {
            const times = getPassingTimes(ts)
            return (
              <div key={ts.id} style={{ marginBottom: 14 }}>
                <div className={styles.trainCard}>
                  <span className={styles.trainType}>{ts.type}</span>
                  <span className={styles.trainName}>{ts.name}</span>
                </div>
                {times.length > 0 ? (
                  <div className={styles.stats} style={{ marginTop: 6 }}>
                    {times.map((t) => (
                      <div key={`${t.kurs}-${t.odjazd}`} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '3px 0' }}>
                        <span className={styles.depTime} style={{ fontSize: 11 }}>{t.odjazd}</span>
                        <span className={styles.statLabel}>→</span>
                        <span className={styles.depTime} style={{ fontSize: 11 }}>{t.przyjazd}</span>
                        <span className={styles.statLabel} style={{ marginLeft: 4 }}>kier. {t.kierunek}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptySchedule}>brak rozkładu na odcinku</div>
                )}
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}
