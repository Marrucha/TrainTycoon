import { useMemo } from 'react'
import { timeToMin } from './MapUtils'

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

    // 2. Pozycje pociągów w ruchu (Interpolacja)
    const trainPositions = useMemo(() => {
        const positions = []
        if (!trainsSets || !cities || !routes) return positions

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

                    let progress
                    if (depMin <= arrMin) {
                        progress = (currentMin - depMin) / (arrMin - depMin || 1)
                    } else {
                        const total = 1440 - depMin + arrMin
                        const elapsed = currentMin >= depMin ? currentMin - depMin : 1440 - depMin + currentMin
                        progress = elapsed / total
                    }
                    progress = Math.max(0, Math.min(1, progress))

                    const route = routes.find(r =>
                        (r.from === fromCity.id && r.to === toCity.id) ||
                        (r.to === fromCity.id && r.from === toCity.id)
                    )

                    if (route) {
                        const reversed = route.from !== fromCity.id
                        positions.push({
                            id: `${ts.id}-${fromStop.kurs}-${i}`,
                            ts,
                            kursId: String(fromStop.kurs),
                            kursStops,
                            routeFromCity: reversed ? toCity : fromCity,
                            routeToCity: reversed ? fromCity : toCity,
                            progress,
                            reversed,
                            routeId: route.id
                        })
                    } else {
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
    }, [trainsSets, cities, routes, currentMin])

    // 3. Liczba pociągów na stacjach
    const trainCountsAtCities = useMemo(() => {
        const counts = {}
        if (!trainsSets || !cities) return counts

        trainsSets.forEach(ts => {
            if (!ts.rozklad?.length) return
            const seen = new Set()

            ts.rozklad.forEach(stop => {
                const dep = timeToMin(stop.odjazd)
                const arr = timeToMin(stop.przyjazd || stop.odjazd)
                const city = cities.find(c => c.id === stop.miasto || c.name === stop.miasto)
                if (!city) return

                const isAtStation = arr <= dep
                    ? currentMin >= arr && currentMin < dep
                    : currentMin >= arr || currentMin < dep

                if (isAtStation && !seen.has(city.id)) {
                    counts[city.id] = (counts[city.id] || 0) + 1
                    seen.add(city.id)
                }
            })
        })
        return counts
    }, [trainsSets, cities, currentMin])

    return { activeRouteStats, trainPositions, trainCountsAtCities }
}
