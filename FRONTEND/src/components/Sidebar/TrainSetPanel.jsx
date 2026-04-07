import { useState, useEffect } from 'react'
import { useGame } from '../../context/GameContext'
import { DEFAULT_PRICE_CONFIG } from '../../context/GameContext'
import { calcDistancePrice, haversineKm } from '../../data/demand'
import styles from './RoutePanel.module.css'

import WagonSection from './trainset/WagonSection'
import RevenueSection from './trainset/RevenueSection'
import CourseSchedule from './trainset/CourseSchedule'
import PositionSection from './trainset/PositionSection'
import TrafficStats from './trainset/TrafficStats'
import DemandMatrix from './trainset/DemandMatrix'
import CrewSection from './trainset/CrewSection'

export default function TrainSetPanel() {
  const { selectedTrainSet, selectTrainSet, trains, getCityById, companyName, cities, getTicketPrice, gameConstants, boardingState, gameDate: now } = useGame()
  const [openKurs, setOpenKurs] = useState(null)
  const [openTimetable, setOpenTimetable] = useState(null)

  const timeMultiplier = gameConstants?.TIME_MULTIPLIER || 30
  const oneGameMonthMs = 30 * 24 * 3600 * 1000 / timeMultiplier
  const newBadgeColor = !selectedTrainSet?.createdAt ? null
    : !selectedTrainSet.firstRouteAt ? 'red'
    : (Date.now() - new Date(selectedTrainSet.firstRouteAt).getTime()) < oneGameMonthMs ? 'green'
    : null

  if (!selectedTrainSet) return null

  const ts = selectedTrainSet
  const stops = ts.routeStops || []
  const fromCity = getCityById(stops[0])
  const toCity = getCityById(stops[stops.length - 1])
  const viaStops = stops.slice(1, -1).map((id) => getCityById(id)?.name || id)

  const wagons = (ts.trainIds || [])
    .map((id) => trains.find((t) => t.id === id))
    .filter(Boolean)

  const wagonGroups = wagons.reduce((acc, w) => {
    const key = w.name || w.type || 'Nieznany'
    if (!acc[key]) acc[key] = { count: 0, seats: w.seats || 0 }
    acc[key].count++
    return acc
  }, {})

  const coursesCount = ts.rozklad?.length
    ? new Set(ts.rozklad.map((s) => s.kurs)).size
    : 0

  // Boarding simulation state — replaces live Firestore currentTransfer/dailyTransfer
  const simState = boardingState?.[ts.id]
  const simCurrentTransfer = simState?.currentTransfer || {}
  const simTransferredToday = simState?.transferredToday || {}
  const simRemainingDemand = simState?.remainingDemand  // null if sim hasn't run yet

  const dailyDemand = ts.dailyDemand || {}             // initial demand (from Firestore, constant)
  const dailyTransfer = simTransferredToday             // simulated transfers so far today
  const totalDailyPassengers = Object.values(dailyDemand).reduce((sum, d) => sum + (d.total || 0), 0)

  const totalOnBoard = Object.values(simCurrentTransfer).reduce((sum, d) => sum + (d.totalOnBoard || 0), 0)
  const totalOnBoardC1 = Object.values(simCurrentTransfer).reduce((sum, d) => {
    const onBoard = d.onBoard || {}
    return sum + Object.values(onBoard).reduce((s, v) => s + (v.class1 || 0), 0)
  }, 0)
  const totalOnBoardC2 = Object.values(simCurrentTransfer).reduce((sum, d) => {
    const onBoard = d.onBoard || {}
    return sum + Object.values(onBoard).reduce((s, v) => s + (v.class2 || 0), 0)
  }, 0)

  const sumTransferred = Object.values(dailyTransfer).reduce((sum, d) => sum + (d.total || 0), 0)
  const totalTransferred = (sumTransferred > 0 || totalOnBoard > 0) ? sumTransferred + totalOnBoard : null
  const totalTransferredC1 = Object.values(dailyTransfer).reduce((sum, d) => sum + (d.class1 || 0), 0) || null
  const totalTransferredC2 = Object.values(dailyTransfer).reduce((sum, d) => sum + (d.class2 || 0), 0) || null

  const totalSeats = wagons.reduce((sum, w) => sum + (w.seats || 0), 0)
  const avgOccupancy = (totalTransferred !== null && totalTransferred > 0 && totalSeats > 0 && coursesCount > 0)
    ? Math.round((totalTransferred / (totalSeats * coursesCount)) * 100)
    : null

  const totalFineRevenue = Object.values(dailyTransfer).reduce((s, d) => s + (d.fineRevenue || 0), 0) || null
  const totalWarsRevenue = Object.values(dailyTransfer).reduce((s, d) => s + (d.warsRevenue || 0), 0) || null
  const avgInspectionIndex = (() => {
    const vals = Object.values(dailyTransfer).map(d => d.inspectionIndex).filter(v => v != null)
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) : null
  })()

  const stopOrder = {}
  ;(ts.routeStops || []).forEach((cityId, idx) => {
    stopOrder[cityId] = idx
  })

  // ---- Revenue calculation Helpers ----
  const pricing = (ts.id ? getTicketPrice(ts.id) : null) ?? DEFAULT_PRICE_CONFIG
  const { class1Per100km = 10, class2Per100km = 6, multipliers = [1,0.9,0.8,0.7,0.65,0.6] } = pricing

  function ticketPrice(fromId, toId, cls) {
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

  const kursRevenue = {}
  let totalDailyRevenue = 0
  Object.entries(dailyTransfer).forEach(([kursId, kd]) => {
    let rev = 0
    Object.entries(kd.od || {}).forEach(([key, val]) => {
      const [fromId, toId] = key.split(':')
      rev += (val.class1 || 0) * ticketPrice(fromId, toId, 1) + (val.class2 || 0) * ticketPrice(fromId, toId, 2)
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
  
  const byKurs = {}
  if (ts.rozklad) {
    ts.rozklad.forEach(s => {
      if (!byKurs[s.kurs]) byKurs[s.kurs] = []
      byKurs[s.kurs].push(s)
    })
  }

  const firstStops = []
  if (ts.rozklad?.length) {
    const byKursFirst = {}
    ts.rozklad.forEach(s => {
      if (!byKursFirst[s.kurs]) byKursFirst[s.kurs] = s
    })
    firstStops.push(...Object.values(byKursFirst).sort((a,b) => timeToMin(a.odjazd) - timeToMin(b.odjazd)))
  }

  let positionState = null
  if (ts.rozklad?.length) {
    const kursGroups = Object.values(byKurs).sort((a, b) => {
      const aMin = Math.min(...a.map(s => timeToMin(s.odjazd)).filter(m => m >= 0), 9999)
      const bMin = Math.min(...b.map(s => timeToMin(s.odjazd)).filter(m => m >= 0), 9999)
      return aMin - bMin
    })

    let found = false
    for (let ki = 0; ki < kursGroups.length; ki++) {
      const kursStops = kursGroups[ki]
      for (let i = 0; i < kursStops.length - 1; i++) {
        const depMin = timeToMin(kursStops[i].odjazd)
        const arrMin = timeToMin(kursStops[i+1].przyjazd)
        if (depMin >= 0 && arrMin >= 0) {
          const inRange = depMin <= arrMin
            ? currentMin >= depMin && currentMin <= arrMin
            : currentMin >= depMin || currentMin <= arrMin
          if (inRange) {
            positionState = { label1: 'W trasie', value1: `${kursStops[i].miasto} → ${kursStops[i+1].miasto}`, label2: 'Przyjazd', value2: kursStops[i+1].przyjazd }
            found = true; break
          }
        }
      }
      if (found) break
      for (let i = 0; i < kursStops.length; i++) {
        const depMin = timeToMin(kursStops[i].odjazd)
        const arrMin = timeToMin(kursStops[i].przyjazd)
        if (depMin >= 0 && arrMin >= 0) {
          const inPostoj = arrMin <= depMin ? currentMin >= arrMin && currentMin <= depMin : currentMin >= arrMin || currentMin <= depMin
          if (inPostoj) {
            positionState = { label1: 'Postój', value1: kursStops[i].miasto, label2: 'Odjazd', value2: kursStops[i].odjazd }
            found = true; break
          }
        }
      }
      if (found) break
    }

    if (!found && kursGroups.length > 0) {
      for (let ki = 0; ki < kursGroups.length; ki++) {
        const lastKurs = kursGroups[ki]
        const nextKurs = kursGroups[(ki+1) % kursGroups.length]
        const lastStop = lastKurs[lastKurs.length - 1]
        const firstNextStop = nextKurs[0]
        const arrMin = timeToMin(lastStop.przyjazd)
        const depMin = timeToMin(firstNextStop.odjazd)
        if (arrMin >= 0 && depMin >= 0) {
          const inGap = arrMin <= depMin ? currentMin >= arrMin && currentMin <= depMin : currentMin >= arrMin || currentMin <= depMin
          if (inGap) {
            positionState = { label1: 'Oczekuje', value1: lastStop.miasto, label2: 'Następny odjazd', value2: firstNextStop.odjazd }
            found = true; break
          }
        }
      }
    }
    if (!found && kursGroups.length > 0) {
      const firstStop = kursGroups[0].find(s => timeToMin(s.odjazd) >= 0)
      const lastKurs = kursGroups[kursGroups.length - 1]
      const lastStop = lastKurs[lastKurs.length - 1]
      const firstDep = firstStop ? timeToMin(firstStop.odjazd) : -1
      const lastArr = timeToMin(lastStop.przyjazd)
      if (firstDep >= 0 && lastArr >= 0) {
         positionState = { label1: 'Baza', value1: lastStop.miasto, label2: 'Pierwszy kurs', value2: firstStop.odjazd }
      }
    }
  }

  // mergedOD: dm = remaining demand (from simulation), tr = transferred, ob = on board
  const demandForMatrix = simRemainingDemand || dailyDemand
  const mergedOD = {}
  const allOdKeysSet = new Set()
  Object.values(demandForMatrix || {}).forEach(d => Object.keys(d.od || {}).forEach(k => allOdKeysSet.add(k)))
  Object.values(dailyTransfer || {}).forEach(d => Object.keys(d.od || {}).forEach(k => allOdKeysSet.add(k)))
  Object.values(simCurrentTransfer || {}).forEach(d => Object.keys(d.onBoard || {}).forEach(k => allOdKeysSet.add(k)))

  allOdKeysSet.forEach(key => {
    mergedOD[key] = { dmC1: 0, dmC2: 0, trC1: 0, trC2: 0, obC1: 0, obC2: 0 }
  })
  Object.values(demandForMatrix || {}).forEach(d => {
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
  Object.values(simCurrentTransfer || {}).forEach(d => {
    Object.entries(d.onBoard || {}).forEach(([key, val]) => {
      mergedOD[key].obC1 += val.class1 || 0
      mergedOD[key].obC2 += val.class2 || 0
    })
  })

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => selectTrainSet(ts)}>← wróć</button>
        <div className={styles.routeTitle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={styles.trainType}>{companyName || ts.type}</span>
            <span className={styles.cities}>{ts.name}</span>
            {newBadgeColor && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                padding: '1px 6px', borderRadius: 3,
                background: newBadgeColor === 'red' ? 'rgba(231,76,60,0.2)' : 'rgba(46,204,113,0.2)',
                border: `1px solid ${newBadgeColor === 'red' ? '#e74c3c' : '#2ecc71'}`,
                color: newBadgeColor === 'red' ? '#e74c3c' : '#2ecc71',
              }}>NEW</span>
            )}
            {Object.values(ts.awarie || {}).some(a => a.isAwaria === 1) && (() => {
              const delays = Object.values(ts.awarie).filter(a => a.isAwaria === 1).map(a => a.awariaTime)
              const maxDelay = Math.max(...delays)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width={14} height={14} style={{ flexShrink: 0 }}>
                    <circle cx={7} cy={7} r={6} fill="#e74c3c" stroke="#fff" strokeWidth={0.8}>
                      <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                    <text x={7} y={10.5} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff" style={{ userSelect: 'none' }}>!</text>
                  </svg>
                  <span style={{ background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 'bold', padding: '1px 5px', borderRadius: 3 }}>
                    +{maxDelay} min
                  </span>
                </div>
              )
            })()}
          </div>
          <span className={styles.meta}>
            {stops.length > 0 ? `${fromCity?.name || stops[0]} ↔ ${toCity?.name || stops[stops.length - 1]}` : 'brak trasy'}
            {viaStops.length > 0 && ` · via: ${viaStops.join(', ')}`}
          </span>
        </div>
      </div>

      <div className={styles.body}>
        <PositionSection positionState={positionState} />
        <CrewSection ts={ts} />
        <WagonSection wagonGroups={wagonGroups} maxSpeed={ts.maxSpeed} totalCostPerKm={ts.totalCostPerKm} wagons={wagons} />
        <RevenueSection byKurs={byKurs} cities={cities} totalCostPerKm={ts.totalCostPerKm} totalDailyRevenue={totalDailyRevenue} />
        <CourseSchedule
          ts={ts} coursesCount={coursesCount} firstStops={firstStops}
          dailyDemand={dailyDemand} remainingDemand={simRemainingDemand}
          dailyTransfer={dailyTransfer} currentTransfer={simCurrentTransfer}
          byKurs={byKurs}
          cities={cities} openKurs={openKurs} setOpenKurs={setOpenKurs}
          openTimetable={openTimetable} setOpenTimetable={setOpenTimetable}
          kursRevenue={kursRevenue} totalDailyRevenue={totalDailyRevenue}
          totalSeats={totalSeats} stopOrder={stopOrder} currentMin={currentMin}
        />
        <TrafficStats totalDailyPassengers={totalDailyPassengers} totalTransferred={totalTransferred} avgOccupancy={avgOccupancy} gapowiczeRate={ts.gapowiczeRate} avgInspectionIndex={avgInspectionIndex} totalFineRevenue={totalFineRevenue} totalWarsRevenue={totalWarsRevenue} />
        <DemandMatrix mergedOD={mergedOD} stopOrder={stopOrder} cities={cities} dailyDemand={dailyDemand} currentTransfer={simCurrentTransfer} />
      </div>
    </div>
  )
}
