import { useState, useEffect } from 'react'
import { useGame } from '../../context/GameContext'
import styles from './RoutePanel.module.css'

const TRAIN_COLORS = [
  '#e74c3c', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c', '#e056fd', '#eb4d4b', '#ff7979', '#badc58'
]

const getTrainColor = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return TRAIN_COLORS[Math.abs(hash) % TRAIN_COLORS.length]
}

export default function RouteSegmentPanel() {
  const { selectedRoute, selectRoute, trainsSets, getCityById, cities, sunTimes } = useGame()
  const [now, setNow] = useState(() => new Date())
  const [tooltip, setTooltip] = useState(null)

  const getDayOfYear = (date) => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }
  const dayOfYear = getDayOfYear(now)
  const todaySun = sunTimes?.[dayOfYear] || { sunrise: 360, sunset: 1080 }
  const nowMin = now.getHours() * 60 + now.getMinutes()
  
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

      let odjazd, przyjazd, dir
      if (fromIdx < toIdx) {
        // from → to (kierunek zgodny z kursem)
        odjazd = f.dep
        przyjazd = t.arr
        dir = 1
      } else {
        // to → from (kurs odwrotny)
        odjazd = t.dep
        przyjazd = f.arr
        dir = 2
      }
      if (!odjazd || !przyjazd) return
      results.push({
        kurs: fromStop.kurs,
        odjazd,
        przyjazd,
        kierunek: fromStop.kierunek || toStop.kierunek || '—',
        dir
      })
    })

    return results.sort((a, b) => a.odjazd.localeCompare(b.odjazd))
  }
  const currentMin = now.getHours() * 60 + now.getMinutes()
  
  const allPasses = trainSetsOnSegment.flatMap((ts) =>
    getPassingTimes(ts).map((t) => ({ ts, ...t }))
  )
  const passesDir1 = allPasses.filter(t => t.dir === 1)
  const passesDir2 = allPasses.filter(t => t.dir === 2)
  
  const currentlyOnSegment = allPasses.filter((t) => {
        const dep = timeToMin(t.odjazd)
        const arr = timeToMin(t.przyjazd)
        if (dep < 0 || arr < 0) return false
        if (dep <= arr) return dep <= currentMin && currentMin <= arr
        // Kurs przekracza północ (np. 23:35 → 00:06)
        return currentMin >= dep || currentMin <= arr
      })

  const renderScale = () => (
    <div className={styles.timelineScale}>
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className={styles.tick} style={{ left: `${(i / 24) * 100}%`, height: i % 3 === 0 ? 8 : 4 }}>
          {i % 3 === 0 && <span className={styles.tickLabel} style={{ marginLeft: i===24 ? -6 : i===0 ? 6 : 0 }}>{i}:00</span>}
        </div>
      ))}
    </div>
  )

  const renderTimelineBlocks = (passes) => {
    const rawBlocks = passes.map((p, i) => {
      const depMin = timeToMin(p.odjazd)
      const arrMin = timeToMin(p.przyjazd)
      if (depMin < 0 || arrMin < 0) return null

      const color = getTrainColor(p.ts.id)
      const segments = []

      if (depMin <= arrMin) {
        segments.push({ left: (depMin / 1440) * 100, width: ((arrMin - depMin) / 1440) * 100 })
      } else {
        segments.push({ left: (depMin / 1440) * 100, width: ((1440 - depMin) / 1440) * 100 })
        segments.push({ left: 0, width: (arrMin / 1440) * 100 })
      }

      return { p, color, segments, start: depMin, row: 0, index: i }
    }).filter(Boolean)

    // Sortowanie i wymijanie bloków
    const sorted = [...rawBlocks].sort((a, b) => a.start - b.start)
    const rows = []

    sorted.forEach((item) => {
      let placed = false
      for (let r = 0; r < rows.length; r++) {
        let intersects = false
        for (const existing of rows[r]) {
          // Check collision between any segments of item and existing
          for (const mySeg of item.segments) {
            for (const exSeg of existing.segments) {
              const myL = mySeg.left
              const myR = mySeg.left + mySeg.width
              const exL = exSeg.left
              const exR = exSeg.left + exSeg.width
              // Strict intersection check (ignoring tiny touch overlaps)
              if (myL < exR - 0.1 && myR > exL + 0.1) {
                intersects = true
                break
              }
            }
            if (intersects) break
          }
          if (intersects) break
        }
        if (!intersects) {
          rows[r].push(item)
          item.row = r
          placed = true
          break
        }
      }
      if (!placed) {
        rows.push([item])
        item.row = rows.length - 1
      }
    })

    return sorted.map((bInfo) => {
      // row > 0 przesuwa blok wyżej
      const topOffset = 8 - (bInfo.row * 7)
      return bInfo.segments.map((b, bIdx) => (
        <div 
          key={`${bInfo.p.ts.id}-${bInfo.index}-${bIdx}`} 
          className={styles.timelineBlock} 
          style={{ 
            left: `${b.left}%`, 
            width: `${Math.max(b.width, 0.4)}%`, 
            background: bInfo.color,
            top: `${topOffset}px` 
          }}
          onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, data: bInfo.p, color: bInfo.color })}
          onMouseLeave={() => setTooltip(null)}
        />
      ))
    })
  }

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
            <span className={styles.sectionLabel}>ROZKŁAD JAZDY NA ODCINKU</span>
          </div>
          
          <div style={{ position: 'relative', margin: '8px 0', padding: '4px 0' }}>
            <div className={styles.currentTimeLine} style={{ left: `${(nowMin / 1440) * 100}%`, top: 0, bottom: 0, height: 'auto', zIndex: 10 }} />

            <div className={styles.timelineLabel}>
              <span>{fromCity?.name} → {toCity?.name}</span>
              <span>24H</span>
            </div>
            <div className={styles.timelineContainer}>
              <div className={styles.timelineDaylight} style={{ left: `${(todaySun.sunrise / 1440) * 100}%`, width: `${((todaySun.sunset - todaySun.sunrise) / 1440) * 100}%` }} />
              <div className={styles.timelineTrack} />
              {renderTimelineBlocks(passesDir1)}
              {renderScale()}
            </div>

            <div className={styles.timelineLabel} style={{ marginTop: 16 }}>
              <span>{toCity?.name} → {fromCity?.name}</span>
              <span>24H</span>
            </div>
            <div className={styles.timelineContainer}>
              <div className={styles.timelineDaylight} style={{ left: `${(todaySun.sunrise / 1440) * 100}%`, width: `${((todaySun.sunset - todaySun.sunrise) / 1440) * 100}%` }} />
              <div className={styles.timelineTrack} />
              {renderTimelineBlocks(passesDir2)}
              {renderScale()}
            </div>
          </div>
        </section>

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
                  <span className={styles.trainType} style={{ borderColor: getTrainColor(ts.id), color: getTrainColor(ts.id) }}>{ts.type}</span>
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

      {tooltip && (
        <div 
          className={styles.tooltipBox} 
          style={{ position: 'fixed', left: Math.min(tooltip.x + 10, window.innerWidth - 220), top: tooltip.y + 15, borderColor: tooltip.color }}
        >
          <div className={styles.tooltipTrainName} style={{ color: tooltip.color }}>{tooltip.data.ts.name}</div>
          <div className={styles.tooltipRelation}>
            {tooltip.data.ts.rozklad[0].miasto} ↔ {tooltip.data.ts.rozklad[tooltip.data.ts.rozklad.length - 1].miasto}
          </div>
          <div className={styles.tooltipRelation} style={{ color: '#8aab8a', marginTop: 4 }}>
            Odcinek: {tooltip.data.odjazd} → {tooltip.data.przyjazd}
          </div>
        </div>
      )}
    </div>
  )
}
