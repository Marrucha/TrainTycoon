import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useGame } from '../../context/GameContext'
import { findMultiPath, findShortestPath } from '../../utils/dijkstra'
import { getDemand } from '../../data/demand'
import CityMarker from '../Map/CityMarker'
import styles from './RoutePlanner.module.css'

function RoutePlannerMapOverlay({ selectedStops, currentPathEdges, onCityClick, hoveredCity, setHoveredCity }) {
    const { cities, routes, getCityById } = useGame()
    const map = useMap()
    const [tick, setTick] = useState(0)

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

    // Render path edges
    const renderPath = () => {
        // Render network background (all routes)
        const networkLines = (routes || []).map((route, i) => {
            const from = getCityById(route.from)
            const to = getCityById(route.to)
            if (!from || !to) return null
            const fp = getPos(from.lat, from.lon)
            const tp = getPos(to.lat, to.lon)
            return (
                <line
                    key={`net-${i}-${route.id}`}
                    x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                    stroke={route.routeTier === 1 ? "rgba(255, 100, 100, 0.4)" : "rgba(255, 255, 255, 0.15)"}
                    strokeWidth={route.routeTier === 1 ? 3 : 2}
                />
            )
        })

        // Render selected path (green)
        const activeLines = currentPathEdges.map((route, i) => {
            const from = getCityById(route.from)
            const to = getCityById(route.to)
            if (!from || !to) return null
            const fp = getPos(from.lat, from.lon)
            const tp = getPos(to.lat, to.lon)

            return (
                <line
                    key={`path-${i}-${route.id}`}
                    x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                    stroke="#4CAF50"
                    strokeWidth={3}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 4px #4CAF50)' }}
                />
            )
        })

        return [...networkLines, ...activeLines]
    }

    const hoveredCityPos = hoveredCity ? getPos(hoveredCity.lat, hoveredCity.lon) : null

    const container = map.getContainer()
    if (!container) return null

    return createPortal(
        <>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: size.x, height: size.y, zIndex: 400, overflow: 'visible', pointerEvents: 'none' }}>
                {renderPath()}

                {(!cities ? [] : cities).map(city => {
                    const pos = getPos(city.lat, city.lon)
                    const stopIndex = selectedStops.indexOf(city.id)
                    const isSelected = stopIndex !== -1

                    return (
                        <g key={city.id} onClick={(e) => { e.stopPropagation(); onCityClick(city); }}>
                            <CityMarker
                                city={city}
                                cx={pos.x} cy={pos.y}
                                isSelected={isSelected}
                                isHovered={hoveredCity?.id === city.id}
                                leafletZoom={leafletZoom}
                                onSelect={() => { }}
                                onHover={setHoveredCity}
                            />
                            {isSelected && (
                                <text x={pos.x} y={pos.y - 12} fill="#000" fontWeight="bold" fontSize="12px" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                                    <tspan dx="0" dy="0" fill="#4CAF50" fontSize="14px">●</tspan>
                                    <tspan dx="-8" dy="1" fill="#000">{stopIndex + 1}</tspan>
                                </text>
                            )}
                        </g>
                    )
                })}
            </svg>

            {hoveredCity && hoveredCityPos && (
                <div
                    className={styles.cityActionTooltip}
                    style={{ left: Math.min(hoveredCityPos.x + 15, size.x - 150), top: Math.max(hoveredCityPos.y - 15, 10) }}
                >
                    <strong>{hoveredCity.name}</strong>
                </div>
            )}
        </>,
        container
    )
}

export default function RoutePlanner({ trainSet, onClose }) {
    const { routes, cities, getCityById, updateCitySchedules, saveTrainRoute, trainsSets } = useGame()

    const [selectedStops, setSelectedStops] = useState(trainSet.routeStops || [])
    const [calcMode, setCalcMode] = useState('fastest') // 'fastest' | 'cheapest'
    const [multiPathResult, setMultiPathResult] = useState(null)
    const [hoveredCity, setHoveredCity] = useState(null)
    const [activeCityModal, setActiveCityModal] = useState(null)

    // Aktualizowanie ścieżki po zmianie miast lub trybu
    useEffect(() => {
        if (selectedStops.length < 2) {
            setMultiPathResult(null)
            return
        }

        const result = findMultiPath(routes, selectedStops, calcMode)
        setMultiPathResult(result)

    }, [selectedStops, calcMode, routes])

    // Pobieranie konkurencji na danym segmencie
    const getCompetitionForSegment = (cityAId, cityBId) => {
        const segmentRoute = routes.find(r =>
            (r.from === cityAId && r.to === cityBId) ||
            (r.to === cityAId && r.from === cityBId)
        )
        if (!segmentRoute || !trainsSets) return []
        
        const routeId = segmentRoute.id || `${segmentRoute.from}-${segmentRoute.to}`
        const altRouteId = `${segmentRoute.to}-${segmentRoute.from}`
        
        return trainsSets.filter(ts => 
            ts.id !== trainSet.id && 
            ts.routes && 
            (ts.routes.includes(routeId) || ts.routes.includes(altRouteId))
        ).map(ts => ts.id)
    }

    const handleCityClick = (city) => {
        setActiveCityModal(city)
    }

    const addStop = (cityId) => {
        setSelectedStops(prev => [...prev, cityId])
        setActiveCityModal(null)
    }

    const removeStopLast = () => {
        setSelectedStops(prev => prev.slice(0, -1))
        setActiveCityModal(null)
    }

    const saveRoute = async () => {
        if (!multiPathResult || selectedStops.length < 2) return

        const routeChanged =
            selectedStops.length !== (trainSet.routeStops || []).length ||
            selectedStops.some((id, i) => id !== (trainSet.routeStops || [])[i])

        // Czyść rozkład tylko jeśli trasa faktycznie się zmieniła
        const rozkladToSave = routeChanged ? [] : (trainSet.rozklad || [])

        // Calculate assigned routes from the path result
        const assignedRoutes = multiPathResult.edges.map(e => e.id || `${e.from}-${e.to}`)

        await saveTrainRoute(trainSet.id, selectedStops, rozkladToSave, assignedRoutes)
        onClose()
    }

    // Checking if there's a difference between fastest and cheapest for the current stops
    const pathsDiffer = useMemo(() => {
        if (selectedStops.length < 2) return false;
        const fastResult = findMultiPath(routes, selectedStops, 'fastest');
        const cheapResult = findMultiPath(routes, selectedStops, 'cheapest');

        if (!fastResult || !cheapResult) return false;
        return fastResult.totalCost !== cheapResult.totalCost || fastResult.totalTime !== cheapResult.totalTime;
    }, [selectedStops, routes]);


    return createPortal(
        <div className={styles.overlay}>
            <header className={styles.header}>
                <h2>Konstruktor Rozkładu: {trainSet.name}</h2>
                <button className={styles.closeBtn} onClick={onClose}>Zamknij</button>
            </header>

            <div className={styles.content}>
                <div className={styles.mapArea}>
                    <MapContainer
                        center={[52.0, 19.5]}
                        zoom={6.5}
                        minZoom={5}
                        maxZoom={12}
                        zoomControl={false}
                        attributionControl={false}
                        style={{ width: '100%', height: '100%', background: '#0d1a0d' }}
                    >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png" />
                        <RoutePlannerMapOverlay
                            selectedStops={selectedStops}
                            currentPathEdges={multiPathResult ? multiPathResult.edges : []}
                            onCityClick={handleCityClick}
                            hoveredCity={hoveredCity}
                            setHoveredCity={setHoveredCity}
                        />
                    </MapContainer>

                    {/* Akcja dla konkretnego miasta po kliknięciu (pojawia się na srodku ekranu zamiast overlay) */}
                    {activeCityModal && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#112211', padding: '20px', border: '2px solid #4CAF50', borderRadius: '8px', zIndex: 1000, color: 'white', textAlign: 'center' }}>
                            <h3>{activeCityModal.name}</h3>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                {!selectedStops.includes(activeCityModal.id) ? (
                                    <button className={styles.actionBtn} onClick={() => addStop(activeCityModal.id)}>Dodaj jako kolejny Przystanek</button>
                                ) : (
                                    selectedStops[selectedStops.length - 1] === activeCityModal.id ? (
                                        <button className={styles.removeActionBtn} onClick={removeStopLast}>Usuń Ostatni Przystanek</button>
                                    ) : (
                                        <span style={{ color: '#aaa', padding: '10px' }}>Stacja wpisana w środek trasy. <br />Aby ją usunąć, musisz cofnąć (usunąć) późniejsze przystanki.</span>
                                    )
                                )}
                                <button className={styles.closeBtn} onClick={() => setActiveCityModal(null)}>Anuluj</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.sidebar}>
                    <div className={styles.sectionTitle}>Stacje w rozkładzie</div>

                    <div className={styles.stopsList}>
                        {selectedStops.length === 0 ? (
                            <span className={styles.emptyStops}>Wybierz stacje klikając na miasta na mapie. Twórz trasę sekwencyjnie.</span>
                        ) : (
                            selectedStops.map((stopId, idx) => {
                                const city = getCityById(stopId)
                                const isLast = idx === selectedStops.length - 1
                                return (
                                    <div key={stopId} className={styles.stopItem}>
                                        <div className={styles.stopNumber}>{idx + 1}</div>
                                        <div className={styles.stopName}>{city?.name}</div>
                                        {isLast && (
                                            <button className={styles.removeStopBtn} onClick={removeStopLast} title="Usuń ostatnią stację">×</button>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {(pathsDiffer || selectedStops.length >= 2) && (
                        <div className={styles.modeToggle}>
                            <button
                                className={`${styles.modeBtn} ${calcMode === 'fastest' ? styles.active : ''}`}
                                onClick={() => setCalcMode('fastest')}
                            >
                                Najszybsza
                            </button>
                            {pathsDiffer && (
                                <button
                                    className={`${styles.modeBtn} ${calcMode === 'cheapest' ? styles.active : ''}`}
                                    onClick={() => setCalcMode('cheapest')}
                                >
                                    Najtańsza
                                </button>
                            )}
                        </div>
                    )}

                    {multiPathResult && (
                        <>
                            <div className={styles.routeStats}>
                                <div className={styles.statRow}>
                                    <span>Dystans całkowity:</span>
                                    <span className={styles.statValue}>{multiPathResult.totalDistance} km</span>
                                </div>
                                <div className={styles.statRow}>
                                    <span>Czas przejazdu (brutto):</span>
                                    <span className={styles.statValue}>{Math.floor(multiPathResult.totalTime / 60)}h {multiPathResult.totalTime % 60}m</span>
                                </div>
                                <div className={styles.statRow}>
                                    <span>Koszt wynajmu torów:</span>
                                    <span className={styles.statValue}>{multiPathResult.totalCost} PLN/km</span>
                                </div>
                            </div>

                            <div className={styles.sectionTitle}>Szczegóły Segmentów</div>
                            <div className={styles.segmentDetails}>
                                {selectedStops.slice(0, -1).map((fromId, idx) => {
                                    const toId = selectedStops[idx + 1]
                                    const fromCity = getCityById(fromId)
                                    const toCity = getCityById(toId)
                                    const comp = getCompetitionForSegment(fromId, toId)

                                    let demandVal = 0;
                                    for (let i = 0; i <= idx; i++) {
                                        for (let j = idx + 1; j < selectedStops.length; j++) {
                                            const cityA = getCityById(selectedStops[i]);
                                            const cityB = getCityById(selectedStops[j]);
                                            if (cityA && cityB) {
                                                demandVal += getDemand(cityA, cityB);
                                            }
                                        }
                                    }


                                    return (
                                        <div key={`seg-${fromId}-${toId}`} className={styles.segmentInfo}>
                                            <div className={styles.segmentHeader}>{fromCity.name} ➔ {toCity.name}</div>
                                            <div className={styles.segmentData}>
                                                <span>Popyt bazowy: <strong style={{ color: '#4cc9f0' }}>{demandVal} pasażerów/dzień</strong></span>
                                                {comp.length > 0 && (
                                                    <span className={styles.competitionList}>Konkurencja: ({comp.length} składy) na tym odcinku</span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    <button
                        className={styles.saveBtn}
                        disabled={selectedStops.length < 2 || !multiPathResult}
                        onClick={saveRoute}
                    >
                        Zapisz Trasę do Rozkładu
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
