import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useGame } from '../../context/GameContext'
import CityMarker from './CityMarker'
import styles from './PolandMap.module.css'

// Modules
import { getBezierCP, quadBezierPoint, quadBezierAngle, getCurvedPath, timeToMin } from './modules/MapUtils'
import { useMapData } from './modules/useMapData'
import { MapTooltips } from './modules/MapTooltips'
import { MapControls } from './modules/MapControls'

function MapOverlay() {
  const {
    cities, routes, trains, trainsSets, loading,
    selectedCity, selectCity,
    selectedTrainSet, selectTrainSet,
    getCityById, getTrainById,
    gameTime
  } = useGame()

  const map = useMap()
  const [tick, setTick] = useState(0)
  const [hoveredCity, setHoveredCity] = useState(null)
  const [hoveredRoute, setHoveredRoute] = useState(null)
  const [hoveredTrain, setHoveredTrain] = useState(null)
  const [hoverHighlightActiveRoutes, setHoverHighlightActiveRoutes] = useState(false)

  const currentMin = useMemo(() => {
    if (!gameTime) return -1
    const [h, m] = gameTime.split(':').map(Number)
    return h * 60 + m
  }, [gameTime])

  // Custom data hook
  const { activeRouteStats, trainPositions, trainCountsAtCities } = useMapData({
    trainsSets, routes, cities, currentMin, trains
  })

  // Demand from hovered city at current hour
  const cityDemandInfo = useMemo(() => {
    if (!hoveredCity || !trainsSets || currentMin < 0) return null
    const cityId = hoveredCity.id
    const currentHour = Math.floor(currentMin / 60)
    const rows = []
    let totalHourlyDemand = 0

    // First pass: collect all hourly demand across all cities to get the total
    trainsSets.forEach(ts => {
      if (!ts.rozklad || !ts.dailyDemand) return
      const byKurs = {}
      ts.rozklad.forEach(s => { if (!byKurs[s.kurs]) byKurs[s.kurs] = []; byKurs[s.kurs].push(s) })
      Object.entries(byKurs).forEach(([kursId, stops]) => {
        const firstStop = stops[0]
        if (!firstStop?.odjazd) return
        const depHour = Math.floor(timeToMin(firstStop.odjazd) / 60)
        if (depHour !== currentHour) return
        const demand = ts.dailyDemand[kursId]
        if (!demand?.od) return
        Object.values(demand.od).forEach(val => {
          totalHourlyDemand += (val.class1 || 0) + (val.class2 || 0)
        })
      })
    })

    // Second pass: collect demand from hoveredCity in current hour
    trainsSets.forEach(ts => {
      if (!ts.rozklad || !ts.dailyDemand) return
      const byKurs = {}
      ts.rozklad.forEach(s => { if (!byKurs[s.kurs]) byKurs[s.kurs] = []; byKurs[s.kurs].push(s) })
      Object.entries(byKurs).forEach(([kursId, stops]) => {
        const cityStop = stops.find(s => {
          const c = cities.find(cc => cc.id === cityId)
          return s.miasto === c?.name || s.miasto === cityId
        })
        if (!cityStop?.odjazd) return
        const depMin = timeToMin(cityStop.odjazd)
        if (depMin < 0 || Math.floor(depMin / 60) !== currentHour) return
        const demand = ts.dailyDemand[kursId]
        if (!demand?.od) return
        let fromCity = 0
        Object.entries(demand.od).forEach(([key, val]) => {
          if (key.split(':')[0] === cityId) fromCity += (val.class1 || 0) + (val.class2 || 0)
        })
        if (fromCity > 0) rows.push({ tsName: ts.name, departure: cityStop.odjazd, demand: fromCity })
      })
    })

    rows.sort((a, b) => b.demand - a.demand)
    return { rows, totalHourlyDemand }
  }, [hoveredCity, trainsSets, currentMin, cities])

  useMapEvents({
    move: () => setTick(t => t + 1),
    zoom: () => setTick(t => t + 1),
  })

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  const getPos = (lat, lon) => {
    try {
      const p = map.latLngToContainerPoint([lat, lon])
      return { x: p.x, y: p.y }
    } catch (e) {
      return { x: 0, y: 0 }
    }
  }

  const leafletZoom = map.getZoom()
  const size = map.getSize()
  const hoveredCityPos = hoveredCity ? getPos(hoveredCity.lat, hoveredCity.lon) : null

  const container = map.getContainer()
  if (!container) return null

  // Helpers for route styling
  const getRouteColor = (route) => {
    if (selectedRoute?.id === route.id) return '#70e070'
    if (hoveredRoute?.id === route.id) return '#90c090'

    const count = activeRouteStats[route.id] || 0
    if (hoverHighlightActiveRoutes && count > 0) {
      if (count > 5) return '#c0392b' // Intensywna czerwień (duże obłożenie)
      if (count > 2) return '#e74c3c' // Czerwień
      if (count > 1) return '#d35400' // Głęboki pomarańczowy (wyraźnie odróżnialny)
      return '#f1c40f' // Słoneczny żółty (1 pociąg)
    }

    if (route.routeTier === 'international') return '#707070'
    if (route.routeTier === 1) return '#7a2222'
    return '#9a6018'
  }

  const getRouteWidth = (route) => {
    const count = activeRouteStats[route.id] || 0
    const isActive = count > 0

    if (selectedRoute?.id === route.id) return 2.0

    // Apply highlight width ONLY when hovering the "SIEĆ" button
    if (hoverHighlightActiveRoutes && isActive) {
      return 2.5 + (count > 2 ? 1 : 0)
    }

    if (route.routeTier === 'international') return 0.8
    if (route.trainId) return 1.7
    if (route.routeTier === 1) return 1.2
    return 0.8
  }

  const isRouteDimmed = (route) => {
    if (hoverHighlightActiveRoutes) return !(activeRouteStats[route.id] > 0)
    if (selectedCity) return route.from !== selectedCity.id && route.to !== selectedCity.id
    return false
  }

  const selectedRoute = null // Placeholder for now

  return createPortal(
    <>
      <svg className={styles.svgOverlay} style={{ width: size.x, height: size.y }}>
        <g opacity={hoverHighlightActiveRoutes ? 0.4 : 1}>
          {(routes || []).map(route => {
            const from = cities.find(c => c.id === route.from)
            const to = cities.find(c => c.id === route.to)
            if (!from || !to) return null

            const fp = getPos(from.lat, from.lon)
            const tp = getPos(to.lat, to.lon)
            const isDimmed = isRouteDimmed(route)

            return (
              <path
                key={route.id}
                d={getCurvedPath(fp.x, fp.y, tp.x, tp.y, route.id)}
                stroke={getRouteColor(route)}
                strokeWidth={getRouteWidth(route)}
                fill="none"
                opacity={isDimmed ? 0.1 : 1}
                style={{ pointerEvents: 'stroke', cursor: 'pointer', transition: 'stroke 0.2s, stroke-width 0.2s' }}
                onMouseEnter={() => !hoveredCity && setHoveredRoute(route)}
                onMouseLeave={() => setHoveredRoute(null)}
              />
            )
          })}
        </g>

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
              trainCount={trainCountsAtCities[city.id] || 0}
            />
          )
        })}

        {trainPositions.map(p => {
          let pos, angle
          if (p.linear) {
            pos = getPos(p.lat, p.lon)
            angle = p.angle || 0
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
              onMouseEnter={() => setHoveredTrain({ ...p, x: pos.x, y: pos.y })}
              onMouseLeave={() => setHoveredTrain(null)}
            >
              <circle r={8} fill="transparent" />
              <g transform={`rotate(${angle})`}>
                <rect x={-4} y={-4} width={8} height={8} rx={1}
                  fill={isSelected ? '#ff8080' : '#c03030'}
                  stroke="#fff" strokeWidth={0.8} />
                <polygon points="4,-3 4,3 8,0" fill={isSelected ? '#ffaaaa' : '#ff5555'} />
              </g>
              {p.ts.awarie?.[p.kursId]?.isAwaria === 1 && (
                <g>
                  <circle cx={5} cy={-9} r={4.5} fill="#e74c3c" stroke="#fff" strokeWidth={0.8}>
                    <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                  <text x={5} y={-6} textAnchor="middle" fontSize="5" fontWeight="bold" fill="#fff" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    !
                  </text>
                </g>
              )}
              {p.ts.noCrewAlert && (
                <g>
                  <circle cx={-5} cy={-9} r={4.5} fill="#e67e22" stroke="#fff" strokeWidth={0.8}>
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite" />
                  </circle>
                  <text x={-5} y={-6} textAnchor="middle" fontSize="6" fontWeight="bold" fill="#fff" style={{ pointerEvents: 'none', userSelect: 'none' }}>⚠</text>
                </g>
              )}
            </g>
          )
        })}

        {/* Alert markers for crew-less trains stopped at a station */}
        {(trainsSets || []).filter(ts => ts.noCrewAlert && ts.noCrewCityId && !trainPositions.some(p => p.ts.id === ts.id)).map(ts => {
          const city = getCityById(ts.noCrewCityId)
          if (!city) return null
          const pos = getPos(city.lat, city.lon)
          return (
            <g key={`nocrew-${ts.id}`}
               transform={`translate(${pos.x + 14}, ${pos.y - 14})`}
               style={{ cursor: 'pointer' }}
               onClick={e => { e.stopPropagation(); selectTrainSet(ts) }}
            >
              <circle r={7} fill="#e67e22" stroke="#fff" strokeWidth={0.8}>
                <animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite" />
              </circle>
              <text textAnchor="middle" dy="3" fontSize="8" fontWeight="bold" fill="#fff" style={{ pointerEvents: 'none', userSelect: 'none' }}>⚠</text>
            </g>
          )
        })}
      </svg>

      <MapTooltips
        hoveredCity={hoveredCity}
        hoveredRoute={hoveredRoute}
        hoveredTrain={hoveredTrain}
        hoveredCityPos={hoveredCityPos}
        size={size}
        cities={cities}
        getCityById={getCityById}
        getTrainById={getTrainById}
        cityDemandInfo={cityDemandInfo}
        gameTime={gameTime}
      />

      <MapControls
        map={map}
        hoverHighlightActiveRoutes={hoverHighlightActiveRoutes}
        setHoverHighlightActiveRoutes={setHoverHighlightActiveRoutes}
      />
    </>
    , container)
}

function ConfigureZoom() {
  const map = useMap()
  useEffect(() => {
    map.options.wheelPxPerZoomLevel = 300
    map.options.zoomSnap = 0.01
    map.options.zoomDelta = 0.01
  }, [map])
  return null
}

export default function PolandMap() {
  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={[52.0, 19.5]}
        zoom={6}
        minZoom={5}
        maxZoom={13}
        zoomSnap={0.01}
        zoomDelta={0.01}
        wheelPxPerZoomLevel={300}
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <ConfigureZoom />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapOverlay />
      </MapContainer>
    </div>
  )
}
