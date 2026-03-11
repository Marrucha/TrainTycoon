import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useGame } from '../../context/GameContext'
import CityMarker from './CityMarker'
import styles from './PolandMap.module.css'

function timeToMin(t) {
  if (!t || t === '—') return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getBezierCP(x1, y1, x2, y2, id) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const dx = x2 - x1, dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 1) return { cpx: mx, cpy: my }
  const offset = Math.min(dist * 0.12, 35)
  const sign = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 0 ? 1 : -1
  return { cpx: mx + (-dy / dist) * offset * sign, cpy: my + (dx / dist) * offset * sign }
}

function quadBezierPoint(x1, y1, cpx, cpy, x2, y2, t) {
  return {
    x: (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpx + t * t * x2,
    y: (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpy + t * t * y2,
  }
}

function quadBezierAngle(x1, y1, cpx, cpy, x2, y2, t) {
  const dx = 2 * (1 - t) * (cpx - x1) + 2 * t * (x2 - cpx)
  const dy = 2 * (1 - t) * (cpy - y1) + 2 * t * (y2 - cpy)
  return Math.atan2(dy, dx) * 180 / Math.PI
}

function MapOverlay() {
  const map = useMap()
  const { selectedCity, selectedRoute, selectedTrainSet, routes, cities, trains, trainsSets, loading, selectCity, selectRoute, selectTrainSet, getTrainById, getCityById, defaultPricing } = useGame()
  const [hoveredCity, setHoveredCity] = useState(null)
  const [hoveredRoute, setHoveredRoute] = useState(null)
  const [hoveredTrain, setHoveredTrain] = useState(null) // { ts, x, y }
  const [, setTick] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useMapEvents({
    move: () => setTick(t => t + 1),
    zoom: () => setTick(t => t + 1),
  })

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  const getPos = (lat, lon) => {
    const p = map.latLngToContainerPoint([lat, lon])
    return { x: p.x, y: p.y }
  }

  const leafletZoom = map.getZoom()
  const size = map.getSize()
  const hoveredCityPos = hoveredCity ? getPos(hoveredCity.lat, hoveredCity.lon) : null

  function getRouteColor(route) {
    if (selectedRoute?.id === route.id) return '#70e070'
    if (hoveredRoute?.id === route.id) return '#90c090'
    if (route.routeTier === 'international') return '#707070'
    if (route.routeTier === 1) return '#7a2222'
    return '#9a6018'
  }

  function getRouteWidth(route) {
    if (selectedRoute?.id === route.id) return 2.0
    if (route.routeTier === 'international') return 0.8
    if (route.trainId) return 1.7
    if (route.routeTier === 1) return 1.2
    return 0.8
  }

  function getCurvedPath(x1, y1, x2, y2, id) {
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
    const offset = Math.min(dist * 0.12, 35)
    const sign = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 0 ? 1 : -1
    const cpx = mx + (-dy / dist) * offset * sign
    const cpy = my + (dx / dist) * offset * sign
    return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`
  }

  function isRouteDimmed(route) {
    if (selectedCity) return route.from !== selectedCity.id && route.to !== selectedCity.id
    return false
  }

  // Pozycje pociągów z rozkładu (czas rzeczywisty)
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const trainPositions = []
  if (trainsSets) {
    trainsSets.forEach(ts => {
      if (!ts.rozklad?.length) return
      const byKurs = {}
      ts.rozklad.forEach(s => {
        if (!byKurs[s.kurs]) byKurs[s.kurs] = []
        byKurs[s.kurs].push(s)
      })
      Object.values(byKurs).forEach(kursStops => {
        for (let i = 0; i < kursStops.length - 1; i++) {
          const fromStop = kursStops[i]
          const toStop = kursStops[i + 1]
          const depMin = timeToMin(fromStop.odjazd)
          const arrMin = timeToMin(toStop.przyjazd || toStop.odjazd)
          if (depMin < 0 || arrMin < 0) continue
          const onSegment = depMin <= arrMin
            ? currentMin >= depMin && currentMin <= arrMin
            : currentMin >= depMin || currentMin <= arrMin
          if (!onSegment) continue
          const fromCity = cities.find(c => c.id === fromStop.miasto || c.name === fromStop.miasto)
          const toCity = cities.find(c => c.id === toStop.miasto || c.name === toStop.miasto)
          if (!fromCity || !toCity) continue
          // Progress (z obsługą przekroczenia północy)
          let progress
          if (depMin <= arrMin) {
            progress = (currentMin - depMin) / (arrMin - depMin)
          } else {
            const total = 1440 - depMin + arrMin
            const elapsed = currentMin >= depMin ? currentMin - depMin : 1440 - depMin + currentMin
            progress = elapsed / total
          }
          progress = Math.max(0, Math.min(1, progress))
          // Znajdź odpowiadający odcinek trasy (dla krzywej Beziera)
          const route = routes.find(r =>
            (r.from === fromCity.id && r.to === toCity.id) ||
            (r.to === fromCity.id && r.from === toCity.id)
          )
          if (route) {
            const reversed = route.from !== fromCity.id
            const routeFromCity = reversed ? toCity : fromCity
            const routeToCity = reversed ? fromCity : toCity
            trainPositions.push({ id: `${ts.id}-${fromStop.kurs}-${i}`, ts, kursId: String(fromStop.kurs), kursStops, routeFromCity, routeToCity, progress, reversed, routeId: route.id })
          } else {
            // Fallback: linia prosta
            const fp = getPos(fromCity.lat, fromCity.lon)
            const tp = getPos(toCity.lat, toCity.lon)
            const lat = fromCity.lat + (toCity.lat - fromCity.lat) * progress
            const lon = fromCity.lon + (toCity.lon - fromCity.lon) * progress
            const angle = Math.atan2(tp.y - fp.y, tp.x - fp.x) * 180 / Math.PI
            trainPositions.push({ id: `${ts.id}-${fromStop.kurs}-${i}`, ts, kursId: String(fromStop.kurs), kursStops, lat, lon, angle, linear: true })
          }
          break
        }
      })
    })
  }

  // Pociągi stojące na stacjach
  const trainCounts = {}
  if (trainsSets) {
    trainsSets.forEach(ts => {
      if (!ts.rozklad?.length) return

      // Grupuj po kursie i sortuj kursy chronologicznie
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

      const seen = new Set()
      const addCity = (miasto) => {
        const city = cities.find(c => c.id === miasto || c.name === miasto)
        if (!city) return
        const key = `${ts.id}-${city.id}`
        if (seen.has(key)) return
        seen.add(key)
        trainCounts[city.id] = (trainCounts[city.id] || 0) + 1
      }

      kursGroups.forEach((stops, ki) => {
        // Postój na stacji pośredniej: przyjazd <= teraz <= odjazd
        stops.forEach(stop => {
          const arrMin = timeToMin(stop.przyjazd)
          const depMin = timeToMin(stop.odjazd)
          if (arrMin < 0 || depMin < 0) return
          const lo = Math.min(arrMin, depMin)
          const hi = Math.max(arrMin, depMin)
          if (currentMin >= lo && currentMin <= hi) addCity(stop.miasto)
        })

        // Okno między końcem tego kursu a początkiem następnego
        const nextKurs = kursGroups[ki + 1]
        if (nextKurs) {
          const lastStop = stops[stops.length - 1]
          const firstNextStop = nextKurs[0]
          const arrMin = timeToMin(lastStop.przyjazd)
          const depMin = timeToMin(firstNextStop.odjazd)
          if (arrMin >= 0 && depMin >= 0) {
            const inGap = arrMin <= depMin
              ? currentMin >= arrMin && currentMin <= depMin
              : currentMin >= arrMin || currentMin <= depMin
            if (inGap) addCity(lastStop.miasto)
          }
        }
      })

      // Okno bezczynności: od końca ostatniego kursu do początku pierwszego
      // (okno okrężne — może przekraczać północ, np. przyjeżdża 23:30, odjeżdża 07:00)
      if (kursGroups.length > 0) {
        const firstStop = kursGroups[0].find(s => timeToMin(s.odjazd) >= 0)
        const lastKurs = kursGroups[kursGroups.length - 1]
        const lastStop = lastKurs[lastKurs.length - 1]
        const firstDep = firstStop ? timeToMin(firstStop.odjazd) : -1
        const lastArr = timeToMin(lastStop.przyjazd)
        if (firstDep >= 0 && lastArr >= 0) {
          const inIdle = lastArr > firstDep
            ? currentMin >= lastArr || currentMin <= firstDep   // przekracza północ
            : currentMin >= lastArr && currentMin <= firstDep   // w ciągu dnia
          if (inIdle) {
            addCity(lastStop.miasto)
            if (firstStop && firstStop.miasto !== lastStop.miasto) addCity(firstStop.miasto)
          }
        }
      }
    })
  }

  const container = map.getContainer()

  return createPortal(
    <>
      <svg
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: size.x, height: size.y,
          zIndex: 400,
          overflow: 'visible',
        }}
      >
        {/* Trasy */}
        {routes.map(route => {
          const from = getCityById(route.from)
          const to = getCityById(route.to)
          if (!from || !to) return null
          const fp = getPos(from.lat, from.lon)
          const tp = getPos(to.lat, to.lon)
          const color = getRouteColor(route)
          const selected = selectedRoute?.id === route.id
          const dimmed = isRouteDimmed(route)
          const d = getCurvedPath(fp.x, fp.y, tp.x, tp.y, route.id)
          return (
            <g
              key={route.id}
              style={{ pointerEvents: route.routeTier === 'international' ? 'none' : 'all', cursor: 'pointer' }}
              onClick={() => selectRoute(route)}
              onMouseEnter={() => setHoveredRoute(route)}
              onMouseLeave={() => setHoveredRoute(null)}
            >
              {/* szeroki niewidoczny obszar kliknięcia */}
              <path d={d} stroke="transparent" strokeWidth={10} fill="none" />
              <path
                d={d}
                stroke={color}
                strokeWidth={getRouteWidth(route)}
                strokeDasharray={selected ? '6 3' : route.routeTier === 'international' ? '5 3' : undefined}
                opacity={dimmed ? 0.1 : 1}
                fill="none"
              />
            </g>
          )
        })}


        {/* Markery miast */}
        {(!loading && cities) && cities.map(city => {
          const pos = getPos(city.lat, city.lon)
          return (
            <CityMarker
              key={city.id}
              city={city}
              cx={pos.x} cy={pos.y}
              isSelected={selectedCity?.id === city.id}
              isHovered={hoveredCity?.id === city.id}
              leafletZoom={leafletZoom}
              onSelect={c => selectCity(c)}
              onHover={setHoveredCity}
              trainCount={trainCounts[city.id] || 0}
            />
          )
        })}

        {/* Pociągi z rozkładu — zawsze na wierzchu */}
        {trainPositions.map(p => {
          let pos, angle
          if (p.linear) {
            pos = getPos(p.lat, p.lon)
            angle = p.angle
          } else {
            const fp = getPos(p.routeFromCity.lat, p.routeFromCity.lon)
            const tp = getPos(p.routeToCity.lat, p.routeToCity.lon)
            const { cpx, cpy } = getBezierCP(fp.x, fp.y, tp.x, tp.y, p.routeId)
            const t = p.reversed ? 1 - p.progress : p.progress
            pos = quadBezierPoint(fp.x, fp.y, cpx, cpy, tp.x, tp.y, t)
            angle = quadBezierAngle(fp.x, fp.y, cpx, cpy, tp.x, tp.y, t)
            if (p.reversed) angle += 180
          }
          const isSelected = selectedTrainSet?.id === p.ts.id
          return (
            <g
              key={p.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); selectTrainSet(p.ts) }}
              onMouseEnter={() => setHoveredTrain({ ts: p.ts, kursId: p.kursId, kursStops: p.kursStops, x: pos.x, y: pos.y })}
              onMouseLeave={() => setHoveredTrain(null)}
            >
              <circle r={8} fill="transparent" />
              <g transform={`rotate(${angle})`}>
                <rect x={-4} y={-4} width={8} height={8} rx={1}
                  fill={isSelected ? '#ff8080' : '#c03030'}
                  stroke="#fff" strokeWidth={0.8} />
                <polygon points="4,-3 4,3 8,0" fill={isSelected ? '#ffaaaa' : '#ff5555'} />
              </g>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {(hoveredCity || hoveredRoute) && (
        <div
          className={styles.tooltip}
          style={hoveredCity && hoveredCityPos ? {
            left: Math.min(hoveredCityPos.x + 14, size.x - 200),
            top: Math.max(hoveredCityPos.y + 8, 4),
            bottom: 'auto',
          } : {}}
        >
          {hoveredCity && (
            <>
              <strong>{hoveredCity.name}</strong>
              {(hoveredCity.country || hoveredCity.voivodeship || hoveredCity.population) && (
                <span>
                  {hoveredCity.country
                    ? `${hoveredCity.country}${hoveredCity.population ? ' · ' + hoveredCity.population.toLocaleString('pl-PL') + ' mk.' : ''}`
                    : hoveredCity.voivodeship
                      ? `${hoveredCity.voivodeship} · ${hoveredCity.population?.toLocaleString('pl-PL')} mk.`
                      : `${hoveredCity.population?.toLocaleString('pl-PL')} mk.`}
                </span>
              )}
              {hoveredCity.platforms && (
                <span>{hoveredCity.platforms} {hoveredCity.platforms === 1 ? 'peron' : hoveredCity.platforms < 5 ? 'perony' : 'peronów'}</span>
              )}
              {hoveredCity.crosses && (
                <span>{hoveredCity.crosses}</span>
              )}
            </>
          )}
          {hoveredRoute && !hoveredCity && (
            <>
              <strong>
                {getCityById(hoveredRoute.from)?.name} ↔ {getCityById(hoveredRoute.to)?.name}
              </strong>
              <span>
                {hoveredRoute.distance} km
                {hoveredRoute.trainId ? ` · ${getTrainById(hoveredRoute.trainId)?.name}` : ' · brak pociągu'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Tooltip najechanego pociągu */}
      {hoveredTrain && (() => {
        const { ts, kursId, kursStops, x, y } = hoveredTrain
        const pricing = ts.pricing ?? defaultPricing ?? {}
        return (
          <div
            className={styles.tooltip}
            style={{ left: Math.min(x + 14, size.x - 210), top: Math.max(y - 10, 4), bottom: 'auto' }}
          >
            <strong>{ts.name}</strong>
            {kursStops?.length > 0 && (() => {
              const ct = ts.currentTransfer?.[kursId] ?? {}
              const dt = ts.dailyTransfer?.[kursId] ?? {}
              const onBoard = ct.onBoard ?? {}
              const alighted = dt.od ?? {}
              const totalOnBoard = ct.totalOnBoard ?? 0
              const totalSeats = ts.totalSeats ?? '—'
              return (
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {kursStops.map((stop, idx) => {
                    const isFirst = idx === 0
                    const isLast  = idx === kursStops.length - 1
                    const cityId  = cities.find(c => c.id === stop.miasto || c.name === stop.miasto)?.id ?? stop.miasto
                    const cityName = cities.find(c => c.id === cityId)?.name ?? stop.miasto
                    const time = isLast ? (stop.przyjazd || stop.odjazd) : stop.odjazd
                    // Pasażerowie jadący DO tej stacji
                    const obEntry = Object.entries(onBoard).find(([k]) => k.split(':')[1] === cityId)
                    const alEntry = Object.entries(alighted).find(([k]) => k.split(':')[1] === cityId)
                    const onBoardCount = obEntry ? obEntry[1].class1 + obEntry[1].class2 : 0
                    const alightedCount = alEntry ? alEntry[1].class1 + alEntry[1].class2 : 0
                    const hasAlighted = alightedCount > 0 && onBoardCount === 0
                    const hasOnBoard  = onBoardCount > 0
                    return (
                      <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#f0c040', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, minWidth: 38, flexShrink: 0 }}>
                          {time || '—'}
                        </span>
                        <span style={{ color: isFirst || isLast ? '#fff' : '#8aab8a', fontWeight: isFirst || isLast ? 600 : 400, fontSize: isFirst || isLast ? '1em' : '0.92em', flex: 1 }}>
                          {cityName}
                        </span>
                        {hasOnBoard && (
                          <span style={{ color: '#f0c040', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, flexShrink: 0 }}>
                            {onBoardCount}
                          </span>
                        )}
                        {hasAlighted && (
                          <span style={{ color: '#4a6a4a', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, flexShrink: 0 }}>
                            {alightedCount}
                          </span>
                        )}
                      </span>
                    )
                  })}
                  {(totalOnBoard > 0 || ts.totalSeats) && (
                    <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, borderTop: '1px solid #2a4a2a', paddingTop: 3, marginTop: 1 }}>
                      <span style={{ color: '#f0c040', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>{totalOnBoard}</span>
                      <span style={{ color: '#4a6a4a', fontSize: 10 }}>/ {totalSeats} miejsc</span>
                    </span>
                  )}
                </span>
              )
            })()}
            {pricing.class1Per100km != null && (
              <span style={{ color: '#8aab8a', fontSize: '0.9em' }}>
                Kl.1: <span style={{ color: '#c0d0c0' }}>{pricing.class1Per100km} PLN</span>
                {' · '}
                Kl.2: <span style={{ color: '#c0d0c0' }}>{pricing.class2Per100km} PLN</span>
                {' '}/ 100km
              </span>
            )}
          </div>
        )
      })()}

      {/* Kontrolki zoom */}
      <div className={styles.zoomControls}>
        <button className={styles.zoomBtn} onClick={() => map.zoomIn()} title="Przybliż">+</button>
        <button className={styles.zoomBtn} onClick={() => map.zoomOut()} title="Oddal">−</button>
        <button className={styles.zoomBtn} onClick={() => map.setView([52.0, 19.5], 6)} title="Reset">⌂</button>
      </div>
    </>,
    container
  )
}

export default function PolandMap() {
  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={[52.0, 19.5]}
        zoom={6}
        minZoom={5}
        maxZoom={13}
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapOverlay />
      </MapContainer>
    </div>
  )
}
