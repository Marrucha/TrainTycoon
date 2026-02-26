import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useGame } from '../../context/GameContext'
import CityMarker from './CityMarker'
import TrainDot from './TrainDot'
import styles from './PolandMap.module.css'

function MapOverlay() {
  const map = useMap()
  const { selectedCity, selectedRoute, routes, cities, loading, selectCity, selectRoute, getTrainById, getCityById } = useGame()
  const [hoveredCity, setHoveredCity] = useState(null)
  const [hoveredRoute, setHoveredRoute] = useState(null)
  const [, setTick] = useState(0)

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
    const p = map.latLngToContainerPoint([lat, lon])
    return { x: p.x, y: p.y }
  }

  const leafletZoom = map.getZoom()
  const size = map.getSize()
  const activeRoutes = routes.filter(r => r.trainId)
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

        {/* Animowane pociągi */}
        {activeRoutes.map(route => {
          const from = getCityById(route.from)
          const to = getCityById(route.to)
          if (!from || !to) return null
          const train = getTrainById(route.trainId)
          return (
            <TrainDot
              key={`dot-${route.id}`}
              from={from} to={to}
              travelTime={route.travelTime}
              trainType={train?.type}
              getPos={getPos}
            />
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
            />
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
