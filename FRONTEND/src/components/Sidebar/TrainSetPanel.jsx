import { useState, useEffect } from 'react'
import { useGame } from '../../context/GameContext'
import { DEFAULT_PRICE_CONFIG } from '../../context/GameContext'
import { calcDistancePrice, haversineKm } from '../../data/demand'
import styles from './RoutePanel.module.css'

export default function TrainSetPanel() {
  const { selectedTrainSet, selectTrainSet, trains, getCityById, companyName, cities, getTicketPrice } = useGame()
  const [openKurs, setOpenKurs] = useState(null)
  const [openTimetable, setOpenTimetable] = useState(null)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000) // update every 10s
    return () => clearInterval(id)
  }, [])

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
  const byKurs = {}
  if (ts.rozklad?.length) {
    ts.rozklad.forEach(s => {
      if (!byKurs[s.kurs]) byKurs[s.kurs] = []
      byKurs[s.kurs].push(s)
    })
  }

  const firstStops = []
  if (ts.rozklad?.length) {
    const byKursFirst = {}
    ts.rozklad.forEach((s) => {
      if (!byKursFirst[s.kurs]) byKursFirst[s.kurs] = s
    })
    Object.values(byKursFirst)
      .sort((a, b) => (a.odjazd || '').localeCompare(b.odjazd || ''))
      .forEach((s) => {
        firstStops.push({ kurs: s.kurs, miasto: s.miasto, odjazd: s.odjazd, kierunek: s.kierunek })
      })
  }

  // Popyt dzienny z backendu
  const dailyDemand = ts.dailyDemand || null
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

  const currentTransfer = ts.currentTransfer || null
  const totalOnBoard = currentTransfer
    ? Object.values(currentTransfer).reduce((sum, d) => sum + (d.totalOnBoard || 0), 0)
    : 0

  const sumTransferred = dailyTransfer
    ? Object.values(dailyTransfer).reduce((sum, d) => sum + (d.total || 0), 0)
    : 0
  const totalTransferred = (sumTransferred > 0 || totalOnBoard > 0) ? sumTransferred + totalOnBoard : null
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

  // Zbiorcza macierz OD ze wszystkich kursów uwzględniająca przewiezionych/jadących i oczekujących
  const mergedOD = {}
  const allOdKeys = new Set()
  
  Object.values(dailyDemand || {}).forEach(d => Object.keys(d.od || {}).forEach(k => allOdKeys.add(k)))
  Object.values(dailyTransfer || {}).forEach(d => Object.keys(d.od || {}).forEach(k => allOdKeys.add(k)))
  Object.values(ts.currentTransfer || {}).forEach(d => Object.keys(d.onBoard || {}).forEach(k => allOdKeys.add(k)))

  allOdKeys.forEach(key => {
    mergedOD[key] = { dmC1: 0, dmC2: 0, trC1: 0, trC2: 0, obC1: 0, obC2: 0 }
  })
  Object.values(dailyDemand || {}).forEach(d => {
    Object.entries(d.od || {}).forEach(([key, val]) => {
      mergedOD[key].dmC1 += val.class1 || 0
      mergedOD[key].dmC2 += val.class2 || 0
    })
  })
  Object.values(dailyTransfer || {}).forEach(d => {
    Object.entries(d.od || {}).forEach(([key, val]) => {
      mergedOD[key].trC1 += val.class1 || 0
      mergedOD[key].trC2 += val.class2 || 0
    })
  })
  Object.values(ts.currentTransfer || {}).forEach(d => {
    Object.entries(d.onBoard || {}).forEach(([key, val]) => {
      mergedOD[key].obC1 += val.class1 || 0
      mergedOD[key].obC2 += val.class2 || 0
    })
  })

  // ---- Revenue calculation ----
  const pricing = (ts.id ? getTicketPrice(ts.id) : null) ?? DEFAULT_PRICE_CONFIG
  const { class1Per100km = 10, class2Per100km = 6, multipliers = [1,0.9,0.8,0.7,0.65,0.6] } = pricing

  function ticketPrice(fromId, toId, cls) {
    // Check for matrix override first
    if (pricing.routePrices) {
      // routePrices keyed by routeId — not directly usable; fall through to distance calc
    }
    if (pricing.matrixOverrides) {
      const key = fromId < toId ? `${fromId}--${toId}` : `${toId}--${fromId}`
      const ov = pricing.matrixOverrides[key]?.[cls === 1 ? 'class1' : 'class2']
      if (ov !== undefined) return ov
    }
    const cityA = cities?.find(c => c.id === fromId || c.name === fromId)
    const cityB = cities?.find(c => c.id === toId   || c.name === toId)
    if (!cityA || !cityB) return 0
    const dist = Math.round(haversineKm(cityA.lat, cityA.lon, cityB.lat, cityB.lon))
    return cls === 1
      ? calcDistancePrice(dist, class1Per100km, multipliers)
      : calcDistancePrice(dist, class2Per100km, multipliers)
  }

  // Revenue per kurs from dailyTransfer
  const kursRevenue = {}  // kursId -> { rev: number }
  let totalDailyRevenue = 0
  Object.entries(ts.dailyTransfer || {}).forEach(([kursId, kd]) => {
    let rev = 0
    Object.entries(kd.od || {}).forEach(([key, val]) => {
      const [fromId, toId] = key.split(':')
      const p1 = ticketPrice(fromId, toId, 1)
      const p2 = ticketPrice(fromId, toId, 2)
      rev += (val.class1 || 0) * p1 + (val.class2 || 0) * p2
    })
    kursRevenue[kursId] = Math.round(rev)
    totalDailyRevenue += rev
  })
  totalDailyRevenue = Math.round(totalDailyRevenue)


  function timeToMin(t) {
    if (!t || t === '—') return -1
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const currentMin = now.getHours() * 60 + now.getMinutes()
  
  let positionState = null // { label1: '...', value1: '...', label2: '...', value2: '...' }
  if (ts.rozklad?.length) {
    const byKurs = {}
    ts.rozklad.forEach(s => {
      if (!byKurs[s.kurs]) byKurs[s.kurs] = []
      byKurs[s.kurs].push(s)
    })
    const kursGroups = Object.values(byKurs).sort((a, b) => {
      const aMin = Math.min(...a.map(s => timeToMin(s.odjazd)).filter(m => m >= 0), 9999)
      const bMin = Math.min(...b.map(s => timeToMin(s.odjazd)).filter(m => m >= 0), 9999)
      return aMin - bMin
    })

    let found = false
    for (let ki = 0; ki < kursGroups.length; ki++) {
      const kursStops = kursGroups[ki]
      
      // 1. W trasie (pomiędzy stacjami)
      for (let i = 0; i < kursStops.length - 1; i++) {
        const fromStop = kursStops[i]
        const toStop = kursStops[i + 1]
        const depMin = timeToMin(fromStop.odjazd)
        const arrMin = timeToMin(toStop.przyjazd || toStop.odjazd)
        if (depMin < 0 || arrMin < 0) continue
        
        const onSegment = depMin <= arrMin 
          ? currentMin >= depMin && currentMin <= arrMin
          : currentMin >= depMin || currentMin <= arrMin
          
        if (onSegment) {
          positionState = { 
            label1: 'W trasie', value1: `${fromStop.miasto} → ${toStop.miasto}`,
            label2: 'Szacowany przyjazd', value2: toStop.przyjazd || toStop.odjazd
          }
          found = true
          break
        }
      }
      if (found) break

      // 2. Postój na stacji w ramach kursu
      for (let i = 0; i < kursStops.length; i++) {
        const stop = kursStops[i]
        const arrMin = timeToMin(stop.przyjazd)
        const depMin = timeToMin(stop.odjazd)
        if (arrMin < 0 || depMin < 0) continue
        const lo = Math.min(arrMin, depMin)
        const hi = Math.max(arrMin, depMin)
        if (currentMin >= lo && currentMin <= hi) {
           positionState = { 
             label1: 'Obecna stacja', value1: stop.miasto,
             label2: 'Odjazd', value2: stop.odjazd
           }
           found = true
           break
        }
      }
      if (found) break
      
      // 3. Postój techniczny / Oczekiwanie na kolejny kurs
      const nextKurs = kursGroups[ki + 1]
      if (nextKurs) {
        const lastStop = kursStops[kursStops.length - 1]
        const firstNextStop = nextKurs[0]
        const arrMin = timeToMin(lastStop.przyjazd)
        const depMin = timeToMin(firstNextStop.odjazd)
        if (arrMin >= 0 && depMin >= 0) {
          const inGap = arrMin <= depMin
            ? currentMin >= arrMin && currentMin <= depMin
            : currentMin >= arrMin || currentMin <= depMin
          if (inGap) {
            positionState = {
               label1: 'Oczekuje', value1: lastStop.miasto,
               label2: 'Następny odjazd', value2: firstNextStop.odjazd
            }
            found = true
            break
          }
        }
      }
    }

    // 4. Zjazd do bazy (nocny postój)
    if (!found && kursGroups.length > 0) {
      const firstStop = kursGroups[0].find(s => timeToMin(s.odjazd) >= 0)
      const lastKurs = kursGroups[kursGroups.length - 1]
      const lastStop = lastKurs[lastKurs.length - 1]
      const firstDep = firstStop ? timeToMin(firstStop.odjazd) : -1
      const lastArr = timeToMin(lastStop.przyjazd)
      if (firstDep >= 0 && lastArr >= 0) {
         positionState = {
           label1: 'Baza', value1: lastStop.miasto,
           label2: 'Pierwszy kurs', value2: firstStop.odjazd
         }
      }
    }
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

        {/* Przychody i koszty */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>PRZYCHODY I KOSZTY</div>
          {(() => {
            let dailyKm = 0
            Object.values(byKurs).forEach(stops => {
              for (let i = 0; i < stops.length - 1; i++) {
                const a = cities?.find(c => c.id === stops[i].miasto || c.name === stops[i].miasto)
                const b = cities?.find(c => c.id === stops[i+1].miasto || c.name === stops[i+1].miasto)
                if (a && b) dailyKm += haversineKm(a.lat, a.lon, b.lat, b.lon)
              }
            })
            dailyKm = Math.round(dailyKm)
            const dailyCost = ts.totalCostPerKm && dailyKm > 0 ? Math.round(ts.totalCostPerKm * dailyKm) : null
            const netBalance = (totalDailyRevenue > 0 || dailyCost !== null)
              ? totalDailyRevenue - (dailyCost ?? 0)
              : null
            return (
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
            )
          })()}
        </section>

        {/* Kursy */}
        <section className={styles.section}>
          <div className={styles.sectionLabelRow}>
            <span className={styles.sectionLabel}>ROZKŁAD KURSÓW</span>
            <span className={styles.depCount}>{coursesCount} kursów / dobę</span>
          </div>
          {firstStops.length > 0 ? (
            <div className={styles.stats}>
              <div style={{ paddingBottom: '6px', marginBottom: '6px', borderBottom: '1px solid #1a2a1a', display: 'flex', gap: '12px', color: '#888', fontSize: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e74c3c' }}></span>W TRAKCIE JAZDY</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0c040' }}></span>ZAKOŃCZYLI</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffffff' }}></span>OCZEKUJĄCY</span>
              </div>
              {(() => {
                let dayObC1 = 0, dayObC2 = 0;
                let dayTrC1 = 0, dayTrC2 = 0;
                let dayDmC1 = 0, dayDmC2 = 0;

                const courseRows = firstStops.map((s) => {
                  const kursDemandTotal = dailyDemand?.[s.kurs]?.total ?? null
                  const currentKursObj = ts.currentTransfer?.[s.kurs]
                  const isStarted = !!currentKursObj

                  let displayVal = 0
                  let isActual = false

                  if (isStarted) {
                    const transferred = dailyTransfer?.[s.kurs]?.total || 0
                    const onBoard = currentKursObj?.totalOnBoard || 0
                    displayVal = transferred + onBoard
                    isActual = true
                  } else if (kursDemandTotal != null) {
                    displayVal = Math.min(kursDemandTotal, totalSeats)
                    isActual = false
                  }

                  const kursDisplay = kursDemandTotal != null || isStarted
                    ? { value: displayVal, transferred: isActual }
                    : null

                  const isOpen = openKurs === s.kurs

                  // OD breakdown dla listy
                  const odDemand = dailyDemand?.[s.kurs]?.od ?? {}
                  const odTransfer = dailyTransfer?.[s.kurs]?.od ?? {}
                  const odOnBoard = currentKursObj?.onBoard ?? {}

                  const odKeys = [...new Set([...Object.keys(odDemand), ...Object.keys(odTransfer), ...Object.keys(odOnBoard)])]
                    .sort((a, b) => {
                      const ta = (odTransfer[a]?.class1 ?? 0) + (odTransfer[a]?.class2 ?? 0)
                      const tb = (odTransfer[b]?.class1 ?? 0) + (odTransfer[b]?.class2 ?? 0)
                      const oa = (odOnBoard[a]?.class1 ?? 0) + (odOnBoard[a]?.class2 ?? 0)
                      const ob = (odOnBoard[b]?.class1 ?? 0) + (odOnBoard[b]?.class2 ?? 0)
                      const da = (odDemand[a]?.class1 ?? 0) + (odDemand[a]?.class2 ?? 0)
                      const db = (odDemand[b]?.class1 ?? 0) + (odDemand[b]?.class2 ?? 0)
                      return (tb + ob + db) - (ta + oa + da)
                    })

                  let kursObC1 = 0, kursObC2 = 0;
                  let kursTrC1 = 0, kursTrC2 = 0;
                  let kursDmC1 = 0, kursDmC2 = 0;

                  odKeys.forEach(key => {
                    const trC1 = odTransfer[key]?.class1 ?? 0;
                    const trC2 = odTransfer[key]?.class2 ?? 0;
                    const obC1 = odOnBoard[key]?.class1 ?? 0;
                    const obC2 = odOnBoard[key]?.class2 ?? 0;
                    const dmC1 = odDemand[key]?.class1 ?? 0;
                    const dmC2 = odDemand[key]?.class2 ?? 0;
                    
                    kursTrC1 += trC1; kursTrC2 += trC2;
                    kursObC1 += obC1; kursObC2 += obC2;
                    kursDmC1 += dmC1; kursDmC2 += dmC2;

                    dayTrC1 += trC1; dayTrC2 += trC2;
                    dayObC1 += obC1; dayObC2 += obC2;
                    dayDmC1 += dmC1; dayDmC2 += dmC2;
                  });
                  
                  const kursOb = kursObC1 + kursObC2;
                  const kursTr = kursTrC1 + kursTrC2;
                  const kursDm = kursDmC1 + kursDmC2;
                  const kursOriginalC1 = kursTrC1 + kursObC1 + kursDmC1;
                  const kursOriginalC2 = kursTrC2 + kursObC2 + kursDmC2;
                  const kursOriginal = kursOriginalC1 + kursOriginalC2;

                  return (
                    <div key={s.kurs}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
                        <span
                          className={styles.depTime}
                          style={{ fontSize: 11, flexShrink: 0, cursor: 'pointer', color: openTimetable === s.kurs ? '#f0c040' : undefined }}
                          onClick={() => setOpenTimetable(openTimetable === s.kurs ? null : s.kurs)}
                          title="Kliknij aby rozwinąć rozkład stacji"
                        >{s.odjazd}</span>
                        <span className={styles.statLabel} style={{ flex: 1 }}>{s.miasto} → {s.kierunek || '—'}</span>
                        <div
                          onClick={() => setOpenKurs(isOpen ? null : s.kurs)}
                          style={{
                            display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0, cursor: 'pointer',
                            justifyContent: 'flex-end', fontSize: 10
                          }}
                        >
                          <div style={{ display: 'flex', gap: 4, fontWeight: 'bold' }}>
                            {kursOb > 0 && <span style={{ color: '#e74c3c', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{kursOb}</span>}
                            {kursTr > 0 && <span style={{ color: '#f0c040', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{kursTr}</span>}
                            {kursDm > 0 && <span style={{ color: '#ffffff', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{kursDm}</span>}
                            {(kursOb === 0 && kursTr === 0 && kursDm === 0) && <span style={{ color: '#4a6a4a', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>0</span>}
                          </div>
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 65 }}>
                            {kursOriginal > 0 ? (
                              <>
                                <span style={{ color: '#8aa88a', fontWeight: 'bold' }}>/ {kursOriginal} os.</span>
                                <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 6 }}>({[
                                  kursOriginalC1 > 0 ? `kl.1: ${Math.round(((kursObC1 + kursTrC1) / kursOriginalC1) * 100)}%` : null,
                                  kursOriginalC2 > 0 ? `kl.2: ${Math.round(((kursObC2 + kursTrC2) / kursOriginalC2) * 100)}%` : null
                                ].filter(Boolean).join(' | ')})</span>
                              </>
                            ) : <span style={{ color: '#6a8a6a' }}>brak popytu</span>}
                            {kursRevenue[s.kurs] > 0 && (
                              <div style={{ color: '#4fc3f7', fontSize: 9, marginTop: 2, fontWeight: 'bold' }}>
                                {kursRevenue[s.kurs].toLocaleString('pl-PL')} PLN
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Timetable: all stops for this kurs */}
                      {openTimetable === s.kurs && byKurs[s.kurs] && (
                        <div style={{ margin: '2px 0 6px 0', padding: '6px 8px', background: '#0a1a0a', borderLeft: '2px solid #f0c040', fontSize: 10 }}>
                          {byKurs[s.kurs].map((stop, idx) => {
                            const cityName = cities?.find(c => c.id === stop.miasto || c.name === stop.miasto)?.name ?? stop.miasto
                            const isFirst = idx === 0
                            const isLast = idx === byKurs[s.kurs].length - 1
                            const time = stop.przyjazd && stop.odjazd && stop.przyjazd !== stop.odjazd
                              ? `${stop.przyjazd} / ${stop.odjazd}`
                              : stop.odjazd || stop.przyjazd || '—'
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: idx < byKurs[s.kurs].length - 1 ? '1px solid #1a2a1a' : 'none' }}>
                                <span style={{ color: '#f0c040', fontFamily: 'monospace', minWidth: 72, flexShrink: 0 }}>{time}</span>
                                <span style={{ color: isFirst || isLast ? '#ffffff' : '#6a9a6a', fontWeight: isFirst || isLast ? 'bold' : 'normal' }}>{cityName}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {/* OD breakdown (existing) */}
                      {isOpen && odKeys.length > 0 && (
                        <div style={{ margin: '2px 0 6px 0', padding: '6px 8px', background: '#0d1f0d', borderLeft: '2px solid #2a4a2a', fontSize: 10 }}>
                          <div style={{ paddingBottom: '6px', marginBottom: '6px', borderBottom: '1px solid #1a2a1a', display: 'flex', gap: '12px', color: '#888' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e74c3c' }}></span>W TRAKCIE JAZDY</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0c040' }}></span>ZAKOŃCZYLI</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffffff' }}></span>OCZEKUJĄCY</span>
                          </div>
                          {(() => {
                            let totalObC1 = 0, totalObC2 = 0;
                            let totalTrC1 = 0, totalTrC2 = 0;
                            let totalDmC1 = 0, totalDmC2 = 0;

                            const rows = odKeys.map((key) => {
                              const [fromId, toId] = key.split(':')
                              const fromName = cities?.find(c => c.id === fromId)?.name ?? fromId
                              const toName = cities?.find(c => c.id === toId)?.name ?? toId
                              
                              const trC1 = odTransfer[key]?.class1 ?? 0;
                              const trC2 = odTransfer[key]?.class2 ?? 0;
                              const obC1 = odOnBoard[key]?.class1 ?? 0;
                              const obC2 = odOnBoard[key]?.class2 ?? 0;
                              const dmC1 = odDemand[key]?.class1 ?? 0;
                              const dmC2 = odDemand[key]?.class2 ?? 0;

                              const tr = trC1 + trC2;
                              const ob = obC1 + obC2;
                              const dm = dmC1 + dmC2;
                              
                              totalTrC1 += trC1; totalTrC2 += trC2;
                              totalObC1 += obC1; totalObC2 += obC2;
                              totalDmC1 += dmC1; totalDmC2 += dmC2;

                              let displayCount = null;
                              let displayColor = '#ffffff'; 
                              
                              if (ob > 0) {
                                displayCount = ob;
                                displayColor = '#e74c3c'; 
                              } else if (tr > 0) {
                                displayCount = tr;
                                displayColor = '#f0c040'; 
                              } else {
                                displayCount = dm; 
                                displayColor = '#ffffff'; 
                              }

                              const originalC1 = trC1 + obC1 + dmC1;
                              const originalC2 = trC2 + obC2 + dmC2;
                              const originalDemand = originalC1 + originalC2;

                              return (
                                <div key={key} style={{ display: 'flex', gap: 6, padding: '2px 0', borderBottom: '1px solid #1a2a1a' }}>
                                  <span style={{ flex: 1, color: '#6a9a6a' }}>{fromName} → {toName}</span>
                                  {(displayCount > 0 || originalDemand > 0) && (
                                    <span style={{ 
                                      color: displayColor, fontWeight: 'bold', minWidth: 26, textAlign: 'center',
                                      border: '1px solid #2a3a2a', borderRadius: 4, padding: '1px 5px', background: 'rgba(0,0,0,0.2)'
                                    }}>
                                      {displayCount > 0 ? displayCount : '0'}
                                    </span>
                                  )}
                                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#6a8a6a', fontWeight: 'bold' }}>/ {originalDemand}</span>
                                    {originalDemand > 0 && (
                                      <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 4 }}>({[
                                        originalC1 > 0 ? `kl.1: ${Math.round(((obC1 + trC1) / originalC1) * 100)}%` : null,
                                        originalC2 > 0 ? `kl.2: ${Math.round(((obC2 + trC2) / originalC2) * 100)}%` : null
                                      ].filter(Boolean).join(' | ')})</span>
                                    )}
                                  </div>
                                </div>
                              )
                            });

                            return (
                              <>
                                {rows}
                                <div style={{ display: 'flex', gap: 6, paddingTop: '6px', marginTop: '4px', borderTop: '1px dashed #2a4a2a', fontWeight: 'bold' }}>
                                  {(() => {
                                    let totalOb = totalObC1 + totalObC2;
                                    let totalTr = totalTrC1 + totalTrC2;
                                    let totalDm = totalDmC1 + totalDmC2;
                                    let totalOriginalC1 = totalTrC1 + totalObC1 + totalDmC1;
                                    let totalOriginalC2 = totalTrC2 + totalObC2 + totalDmC2;
                                    let totalOriginal = totalOriginalC1 + totalOriginalC2;

                                    return (
                                      <>
                                        <span style={{ flex: 1, color: '#888' }}>SUMA</span>
                                        <div style={{ display: 'flex', gap: '4px', textAlign: 'right', justifyContent: 'flex-end', alignItems: 'center' }}>
                                          {totalOb > 0 && <span style={{ color: '#e74c3c', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{totalOb}</span>}
                                          {totalTr > 0 && <span style={{ color: '#f0c040', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{totalTr}</span>}
                                          {totalDm > 0 && <span style={{ color: '#ffffff', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{totalDm}</span>}
                                        </div>
                                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                          <span style={{ color: '#8aa88a', fontWeight: 'bold' }}>/ {totalOriginal}</span>
                                          {totalOriginal > 0 && (
                                            <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 4 }}>({[
                                              totalOriginalC1 > 0 ? `kl.1: ${Math.round(((totalObC1 + totalTrC1) / totalOriginalC1) * 100)}%` : null,
                                              totalOriginalC2 > 0 ? `kl.2: ${Math.round(((totalObC2 + totalTrC2) / totalOriginalC2) * 100)}%` : null
                                            ].filter(Boolean).join(' | ')})</span>
                                          )}
                                        </div>
                                      </>
                                    )
                                  })()}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )
                });

                let dayOb = dayObC1 + dayObC2;
                let dayTr = dayTrC1 + dayTrC2;
                let dayDm = dayDmC1 + dayDmC2;
                let dayOriginalC1 = dayTrC1 + dayObC1 + dayDmC1;
                let dayOriginalC2 = dayTrC2 + dayObC2 + dayDmC2;
                let dayOriginal = dayOriginalC1 + dayOriginalC2;

                return (
                  <>
                    {courseRows}
                    <div style={{ 
                      display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 8px 6px 8px', marginTop: 8,
                      borderTop: '2px dashed #1a2a1a', background: 'rgba(25, 45, 25, 0.2)', borderRadius: '0 0 6px 6px'
                    }}>
                      <span style={{ flex: 1, color: '#8ab88a', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 }}>PODSUMOWANIE DNIA</span>
                      <div
                        style={{
                          display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0,
                          justifyContent: 'flex-end', fontSize: 10
                        }}
                      >
                        <div style={{ display: 'flex', gap: 4, fontWeight: 'bold' }}>
                          {dayOb > 0 && <span style={{ color: '#e74c3c', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{dayOb}</span>}
                          {dayTr > 0 && <span style={{ color: '#f0c040', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{dayTr}</span>}
                          {dayDm > 0 && <span style={{ color: '#ffffff', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{dayDm}</span>}
                          {(dayOb === 0 && dayTr === 0 && dayDm === 0) && <span style={{ color: '#4a6a4a', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>0</span>}
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 65 }}>
                          {dayOriginal > 0 ? (
                            <>
                              <span style={{ color: '#8aa88a', fontWeight: 'bold' }}>/ {dayOriginal} os.</span>
                              <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 6 }}>({[
                                dayOriginalC1 > 0 ? `kl.1: ${Math.round(((dayObC1 + dayTrC1) / dayOriginalC1) * 100)}%` : null,
                                dayOriginalC2 > 0 ? `kl.2: ${Math.round(((dayObC2 + dayTrC2) / dayOriginalC2) * 100)}%` : null
                              ].filter(Boolean).join(' | ')})</span>
                            </>
                          ) : <span style={{ color: '#6a8a6a' }}>brak popytu</span>}
                          {totalDailyRevenue > 0 && (
                            <div style={{ color: '#4fc3f7', fontSize: 10, marginTop: 2, fontWeight: 'bold' }}>
                              {totalDailyRevenue.toLocaleString('pl-PL')} PLN
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
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
              <span className={styles.statLabel}>Śr. obłożenie</span>
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
        {Object.keys(mergedOD).length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>POPYT OD (pary miast / dobę)</div>
            <div className={styles.stats}>
              {Object.entries(mergedOD)
                .sort((a, b) => {
                  const bTotal = b[1].dmC1 + b[1].dmC2 + b[1].trC1 + b[1].trC2 + b[1].obC1 + b[1].obC2;
                  const aTotal = a[1].dmC1 + a[1].dmC2 + a[1].trC1 + a[1].trC2 + a[1].obC1 + a[1].obC2;
                  return bTotal - aTotal;
                })
                .map(([key, val]) => {
                  const [fromId, toId] = key.split(':')
                  const fromName = cities?.find(c => c.id === fromId)?.name ?? fromId
                  const toName = cities?.find(c => c.id === toId)?.name ?? toId
                  
                  const origC1 = val.dmC1 + val.trC1 + val.obC1;
                  const origC2 = val.dmC2 + val.trC2 + val.obC2;
                  const origTotal = origC1 + origC2;
                  
                  return (
                    <div key={key} className={styles.statRow} style={{ borderBottom: '1px solid #1a2a1a', padding: '4px 0', alignItems: 'flex-start' }}>
                      <span className={styles.statLabel} style={{ flex: 1, color: '#6a9a6a', paddingTop: 2 }}>{fromName} → {toName}</span>
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ color: '#8aa88a', fontWeight: 'bold' }}>
                          {origTotal.toLocaleString('pl-PL')} os.
                          {origTotal > 0 && (
                            <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 6 }}>
                              ({Math.round(((val.obC1 + val.obC2 + val.trC1 + val.trC2) / origTotal) * 100)}%)
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#6a8a6a', fontSize: 9, marginTop: 2 }}>
                          {[
                            origC1 > 0 ? `kl.1: ${origC1} os. (${Math.round(((val.obC1 + val.trC1) / origC1) * 100)}%)` : null,
                            origC2 > 0 ? `kl.2: ${origC2} os. (${Math.round(((val.obC2 + val.trC2) / origC2) * 100)}%)` : null
                          ].filter(Boolean).join(' | ')}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>
        )}


      </div>
    </div>
  )
}
