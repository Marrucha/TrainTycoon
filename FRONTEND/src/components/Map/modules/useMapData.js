import { useMemo } from 'react'
import { timeToMin } from './MapUtils'
import { findShortestPath } from '../../../utils/dijkstra'

export function useMapData({ trainsSets, routes, cities, currentMin, trains }) {
    // 1. Statystyki aktywnych tras (kto obsługuje dany odcinek)
    const activeRouteStats = useMemo(() => {
        const counts = {}
        if (!trainsSets || !routes || !cities) return counts

        trainsSets.forEach(ts => {
            const routeIdsForThisTS = new Set()

            if (ts.assignedRoutes && Array.isArray(ts.assignedRoutes)) {
                ts.assignedRoutes.forEach(rid => routeIdsForThisTS.add(rid))
            }

            if (ts.rozklad && routeIdsForThisTS.size === 0) {
                const byKurs = {}
                ts.rozklad.forEach(s => {
                    if (!byKurs[s.kurs]) byKurs[s.kurs] = []
                    byKurs[s.kurs].push(s)
                })

                Object.values(byKurs).forEach(stops => {
                    for (let i = 0; i < stops.length - 1; i++) {
                        const fromCity = cities.find(c => c.id === stops[i].miasto || c.name === stops[i].miasto)
                        const toCity = cities.find(c => c.id === stops[i + 1].miasto || c.name === stops[i + 1].miasto)
                        if (!fromCity || !toCity) continue

                        const route = routes.find(r =>
                            (r.from === fromCity.id && r.to === toCity.id) ||
                            (r.to === fromCity.id && r.from === toCity.id)
                        )
                        if (route) routeIdsForThisTS.add(route.id)
                    }
                })
            }

            routeIdsForThisTS.forEach(rid => {
                counts[rid] = (counts[rid] || 0) + 1
            })
        })
        return counts
    }, [trainsSets, routes, cities])

    // 2a. Pre-compute ścieżki dla odcinków rozkładu (stabilne — nie zależy od currentMin)
    const segmentPaths = useMemo(() => {
        const cache = {}
        if (!trainsSets || !cities || !routes) return cache
        trainsSets.forEach(ts => {
            if (!ts.rozklad?.length) return
            if (!ts.dailyDemand || Object.keys(ts.dailyDemand).length === 0) return
            const byKurs = {}
            ts.rozklad.forEach(s => { if (!byKurs[s.kurs]) byKurs[s.kurs] = []; byKurs[s.kurs].push(s) })
            Object.values(byKurs).forEach(kursStops => {
                for (let i = 0; i < kursStops.length - 1; i++) {
                    const fromCity = cities.find(c => c.id === kursStops[i].miasto || c.name === kursStops[i].miasto)
                    const toCity = cities.find(c => c.id === kursStops[i + 1].miasto || c.name === kursStops[i + 1].miasto)
                    if (!fromCity || !toCity) continue
                    const key = `${fromCity.id}:${toCity.id}`
                    if (!cache[key]) cache[key] = findShortestPath(routes, fromCity.id, toCity.id, 'fastest')
                }
            })
        })
        return cache
    }, [trainsSets, routes, cities])

    // 2b. Pozycje pociągów w ruchu (Interpolacja)
    const trainPositions = useMemo(() => {
        const positions = []
        if (!trainsSets || !cities || !routes) return positions

        trainsSets.forEach(ts => {
            if (!ts.rozklad?.length) return
            if (!ts.dailyDemand || Object.keys(ts.dailyDemand).length === 0) return

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

                    let progress
                    if (depMin <= arrMin) {
                        progress = (currentMin - depMin) / (arrMin - depMin || 1)
                    } else {
                        const total = 1440 - depMin + arrMin
                        const elapsed = currentMin >= depMin ? currentMin - depMin : 1440 - depMin + currentMin
                        progress = elapsed / total
                    }
                    progress = Math.max(0, Math.min(1, progress))

                    const pathResult = segmentPaths[`${fromCity.id}:${toCity.id}`]

                    if (pathResult && pathResult.edges.length > 0) {
                        // Rozłóż postęp proporcjonalnie do odległości po sub-krawędziach
                        const totalDist = pathResult.totalDistance || 1
                        let accFrac = 0
                        for (let ei = 0; ei < pathResult.edges.length; ei++) {
                            const edge = pathResult.edges[ei]
                            const edgeFrac = edge.distance / totalDist
                            const edgeEnd = accFrac + edgeFrac

                            if (progress <= edgeEnd || ei === pathResult.edges.length - 1) {
                                const localProgress = edgeFrac > 0
                                    ? Math.max(0, Math.min(1, (progress - accFrac) / edgeFrac))
                                    : 0
                                const routeFromCity = cities.find(c => c.id === edge.from)
                                const routeToCity = cities.find(c => c.id === edge.to)
                                if (!routeFromCity || !routeToCity) break
                                // Czy pociąg jedzie zgodnie z kierunkiem krawędzi?
                                const reversed = pathResult.path[ei] !== edge.from
                                positions.push({
                                    id: `${ts.id}-${fromStop.kurs}-${i}`,
                                    ts,
                                    kursId: String(fromStop.kurs),
                                    kursStops,
                                    routeFromCity,
                                    routeToCity,
                                    progress: localProgress,
                                    reversed,
                                    routeId: edge.id
                                })
                                break
                            }
                            accFrac = edgeEnd
                        }
                    } else {
                        // Fallback: brak ścieżki w grafie — interpolacja liniowa
                        positions.push({
                            id: `${ts.id}-${fromStop.kurs}-${i}`,
                            ts,
                            kursId: String(fromStop.kurs),
                            kursStops,
                            lat: fromCity.lat + (toCity.lat - fromCity.lat) * progress,
                            lon: fromCity.lon + (toCity.lon - fromCity.lon) * progress,
                            linear: true
                        })
                    }
                    break
                }
            })
        })
        return positions
    }, [trainsSets, cities, routes, currentMin, segmentPaths])

    // 3. Liczba pociągów na stacjach (pociągi, które fizycznie stoją w mieście)
    const trainCountsAtCities = useMemo(() => {
        const counts = {}
        if (!trainsSets || !cities) return counts

        trainsSets.forEach(ts => {
            if (!ts.rozklad?.length) return
            if (!ts.dailyDemand || Object.keys(ts.dailyDemand).length === 0) return

            // Jeśli pociąg jest w ruchu (na odcinku), nie zliczamy go jako stojący na stacji
            const isMoving = trainPositions.some(p => p.ts.id === ts.id)
            if (isMoving) return

            // Znajdź wszystkie punkty czasowe (przyjazdy/odjazdy) dla tego pociągu
            const stops = ts.rozklad.map(s => {
                const city = cities.find(c => c.id === s.miasto || c.name === s.miasto)
                // Używamy odjazdu jako punktu referencyjnego, lub przyjazdu jeśli odjazdu brak
                const tArr = timeToMin(s.przyjazd)
                const tDep = timeToMin(s.odjazd)
                return {
                    cityId: city?.id,
                    time: tArr >= 0 ? tArr : tDep
                }
            }).filter(s => s.cityId && s.time >= 0)
                .sort((a, b) => a.time - b.time)

            if (stops.length === 0) return

            // Znajdź ostatni punkt czasowy, który już "minął" względem aktualnego czasu gry
            let currentStop = null
            for (let i = stops.length - 1; i >= 0; i--) {
                if (stops[i].time <= currentMin) {
                    currentStop = stops[i]
                    break
                }
            }

            // Jeśli żaden punkt nie minął (jest wcześnie rano, przed pierwszym kursem),
            // pociąg stoi na stacji, na której skończył wczorajszą pracę (ostatni stop w rozkładzie)
            if (!currentStop) {
                currentStop = stops[stops.length - 1]
            }

            if (currentStop) {
                counts[currentStop.cityId] = (counts[currentStop.cityId] || 0) + 1
            }
        })
        return counts
    }, [trainsSets, cities, currentMin, trainPositions])

    return { activeRouteStats, trainPositions, trainCountsAtCities }
}
