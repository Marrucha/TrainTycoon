import { useState, useEffect, useMemo } from 'react'
import { useGame } from '../../context/GameContext'
import { findShortestPath } from '../../utils/dijkstra'
import { calcCompositionSpeed, calcEdgeTravelTime } from '../../utils/trainSpeed'
import { timeToMins, minsToTime, isColliding } from '../../utils/scheduleTimeHelpers'

export default function useScheduleCourses(trainSet) {
    const { routes, cities, getCityById, saveTrainRoute, trainsSets, gameSettings } = useGame()

    const [courses, setCourses] = useState([])
    const [activeCourseId, setActiveCourseId] = useState(1)
    const [validationError, setValidationError] = useState(null)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [highlightedStop, setHighlightedStop] = useState(null)

    const compSpeed = useMemo(() => {
        if (!trainSet.locoMaxSpeed || !trainSet.trainIds?.length) return null
        const minSpd = trainSet.maxSpeed || trainSet.locoMaxSpeed
        return calcCompositionSpeed(trainSet.locoMaxSpeed, trainSet.trainIds.length, minSpd)
    }, [trainSet])

    const getTravelTime = (cityA, cityB) => {
        const res = findShortestPath(routes, cityA, cityB, 'fastest')
        if (!res) return 60
        if (!compSpeed) return res.totalTime
        return res.edges.reduce((sum, edge) => sum + calcEdgeTravelTime(compSpeed, edge.distance, edge.travelTime), 0)
    }

    const getStopDuration = (cityId) => {
        const city = getCityById(cityId)
        const pop = city?.population ?? 0
        if (pop >= 500000) return 10
        if (pop >= 100000) return 5
        return 3
    }

    const generateStops = (stopIds, startMins) => {
        let curr = startMins
        const result = []
        for (let i = 0; i < stopIds.length; i++) {
            const cityId = stopIds[i]
            if (i === 0) {
                result.push({
                    cityId, arrival: null, departure: minsToTime(curr),
                    travelFromPrev: 0, stopDuration: 0, arrMins: null, depMins: curr
                })
            } else {
                const prevId = stopIds[i - 1]
                const travel = getTravelTime(prevId, cityId)
                const arr = curr + travel
                const stopD = i === stopIds.length - 1 ? 0 : getStopDuration(cityId)
                const dep = arr + stopD
                curr = dep
                result.push({
                    cityId, arrival: minsToTime(arr),
                    departure: i === stopIds.length - 1 ? null : minsToTime(dep),
                    travelFromPrev: travel, stopDuration: stopD, arrMins: arr, depMins: dep
                })
            }
        }
        return result
    }

    useEffect(() => {
        if (!trainSet.routeStops || trainSet.routeStops.length < 2) return

        if (trainSet.rozklad && trainSet.rozklad.length > 0) {
            const byKurs = {}
            for (const r of trainSet.rozklad) {
                if (!byKurs[r.kurs]) byKurs[r.kurs] = []
                byKurs[r.kurs].push(r)
            }

            const parsedCourses = Object.keys(byKurs)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(kId => {
                    const kursStops = byKurs[kId]
                    const originName = kursStops[0].miasto
                    const originCity = cities.find(c => c.name === originName)
                    const baseOriginId = trainSet.routeStops[0]
                    const direction = (originCity && originCity.id === baseOriginId) ? 'forward' : 'backward'

                    const stops = kursStops.map((s, idx) => {
                        const city = cities.find(c => c.name === s.miasto)
                        const cityId = city ? city.id : null

                        const arrMins = s.przyjazd ? timeToMins(s.przyjazd) : null
                        const depMins = s.odjazd ? timeToMins(s.odjazd) : null

                        let travelFromPrev = 0
                        if (idx > 0) {
                            const prev = kursStops[idx - 1]
                            const prevDep = prev.odjazd ? timeToMins(prev.odjazd) : 0
                            travelFromPrev = arrMins - prevDep
                            if (travelFromPrev < 0) travelFromPrev += 24 * 60
                        }

                        let stopDuration = 0
                        if (idx < kursStops.length - 1) {
                            stopDuration = depMins - arrMins
                            if (stopDuration < 0) stopDuration += 24 * 60
                        }

                        return { cityId, arrival: s.przyjazd, departure: s.odjazd, travelFromPrev, stopDuration, arrMins, depMins }
                    })

                    let cumulativeMins = stops[0].depMins
                    stops[0].arrMins = null
                    for (let i = 1; i < stops.length; i++) {
                        const travel = stops[i].travelFromPrev
                        let targetArr = cumulativeMins + travel
                        stops[i].arrMins = targetArr

                        if (i < stops.length - 1) {
                            const stopDur = stops[i].stopDuration
                            let targetDep = targetArr + stopDur
                            stops[i].depMins = targetDep
                            cumulativeMins = targetDep
                        } else {
                            stops[i].depMins = null
                        }
                    }

                    return { id: parseInt(kId), direction, stops }
                })
            setCourses(parsedCourses)
        } else {
            const c1Stops = generateStops(trainSet.routeStops, 8 * 60)
            setCourses([{ id: 1, direction: 'forward', stops: c1Stops }])
        }
        // eslint-disable-next-line
    }, [trainSet.routeStops, trainSet.rozklad, cities])

    useEffect(() => {
        if (validationError) setValidationError(null)
        if (highlightedStop) setHighlightedStop(null)
        // eslint-disable-next-line
    }, [courses])

    const handleAddCourse = () => {
        if (courses.length === 0) {
            const c1Stops = generateStops(trainSet.routeStops, 8 * 60)
            const newCourse = { id: 1, direction: 'forward', stops: c1Stops }
            setCourses([newCourse])
            setActiveCourseId(1)
            return
        }
        const lastCourse = courses[courses.length - 1]
        if (!lastCourse) return

        const startMins = lastCourse.stops[lastCourse.stops.length - 1].arrMins + 60
        const newDirection = lastCourse.direction === 'forward' ? 'backward' : 'forward'

        const baseStops = trainSet.routeStops
        const newStopIds = newDirection === 'forward' ? [...baseStops] : [...baseStops].reverse()

        const newStops = generateStops(newStopIds, startMins)

        setCourses([...courses, { id: lastCourse.id + 1, direction: newDirection, stops: newStops }])
        setActiveCourseId(lastCourse.id + 1)
    }

    const handleRemoveLastCourse = () => {
        if (courses.length === 0) return
        const newCourses = courses.slice(0, -1)
        setCourses(newCourses)
        setActiveCourseId(newCourses.length > 0 ? newCourses[newCourses.length - 1].id : null)
    }

    const recalculateCoursesFrom = (courseIndex, stopIndex, newDepMins, explicitVal = null) => {
        const newCourses = JSON.parse(JSON.stringify(courses))

        newCourses[courseIndex].stops[stopIndex].depMins = newDepMins
        newCourses[courseIndex].stops[stopIndex].departure = explicitVal ? explicitVal : minsToTime(newDepMins)

        for (let i = stopIndex + 1; i < newCourses[courseIndex].stops.length; i++) {
            const stop = newCourses[courseIndex].stops[i]
            const prevStop = newCourses[courseIndex].stops[i - 1]

            stop.arrMins = prevStop.depMins + stop.travelFromPrev
            stop.arrival = minsToTime(stop.arrMins)

            if (i < newCourses[courseIndex].stops.length - 1) {
                stop.depMins = stop.arrMins + stop.stopDuration
                stop.departure = minsToTime(stop.depMins)
            }
        }

        for (let c = courseIndex + 1; c < newCourses.length; c++) {
            const prevCourse = newCourses[c - 1]
            const prevEndArr = prevCourse.stops[prevCourse.stops.length - 1].arrMins

            const minAllowedDep = prevEndArr + 60
            let currentDep = newCourses[c].stops[0].depMins

            if (currentDep < minAllowedDep) {
                currentDep = minAllowedDep
            }

            newCourses[c].stops[0].depMins = currentDep
            newCourses[c].stops[0].departure = minsToTime(currentDep)

            for (let i = 1; i < newCourses[c].stops.length; i++) {
                const stop = newCourses[c].stops[i]
                const prevStop = newCourses[c].stops[i - 1]

                stop.arrMins = prevStop.depMins + stop.travelFromPrev
                stop.arrival = minsToTime(stop.arrMins)

                if (i < newCourses[c].stops.length - 1) {
                    stop.depMins = stop.arrMins + stop.stopDuration
                    stop.departure = minsToTime(stop.depMins)
                }
            }
        }

        setCourses(newCourses)
    }

    const handleTimeChange = (courseIndex, stopIndex, val) => {
        if (!val) return
        const newMins = timeToMins(val)

        const newCourses = JSON.parse(JSON.stringify(courses))

        const oldAbsMins = newCourses[courseIndex].stops[stopIndex].depMins
        const baseDayMins = Math.floor(oldAbsMins / (24 * 60)) * 24 * 60

        let targetAbsMins = baseDayMins + newMins

        if (targetAbsMins - oldAbsMins < -12 * 60) {
            targetAbsMins += 24 * 60
        } else if (targetAbsMins - oldAbsMins > 12 * 60) {
            targetAbsMins -= 24 * 60
        }

        const arrMins = courses[courseIndex].stops[stopIndex].arrMins
        if (arrMins !== null && arrMins !== undefined && targetAbsMins < arrMins + 3) {
            targetAbsMins = arrMins + 3
        }

        recalculateCoursesFrom(courseIndex, stopIndex, targetAbsMins, minsToTime(targetAbsMins))
    }

    const getDetailedItinerary = (courseStops) => {
        const itin = []
        for (let i = 0; i < courseStops.length - 1; i++) {
            const startCityId = courseStops[i].cityId
            const endCityId = courseStops[i + 1].cityId
            const depTime = courseStops[i].depMins

            const segment = findShortestPath(routes, startCityId, endCityId, 'fastest')
            if (!segment) continue

            let currentTime = depTime
            for (let j = 0; j < segment.edges.length; j++) {
                const edge = segment.edges[j]
                const entry = currentTime
                const exit = currentTime + edge.travelTime
                const fId = segment.path[j]
                const tId = segment.path[j + 1]

                itin.push({
                    edgeId: edge.id || `${edge.from}-${edge.to}`,
                    fromId: fId,
                    toId: tId,
                    entry,
                    exit,
                    tier: edge.routeTier || 2
                })
                currentTime = exit
            }
        }
        return itin
    }

    const getItineraryFromRozklad = (rozklad) => {
        const byKurs = {}
        rozklad.forEach(r => {
            if (!byKurs[r.kurs]) byKurs[r.kurs] = []
            byKurs[r.kurs].push(r)
        })

        const itin = []
        Object.values(byKurs).forEach(stops => {
            const stopsWithId = stops.map(s => ({
                cityId: cities.find(c => c.name === s.miasto)?.id,
                depMins: s.odjazd ? timeToMins(s.odjazd) : null,
            })).filter(s => s.cityId)

            if (stopsWithId.length < 2) return
            let currentAbs = stopsWithId[0].depMins
            for (let i = 0; i < stopsWithId.length - 1; i++) {
                const s1 = stopsWithId[i]
                const s2 = stopsWithId[i + 1]
                const segmentInfo = findShortestPath(routes, s1.cityId, s2.cityId, 'fastest')
                if (!segmentInfo) continue

                let segmentEntryTime = currentAbs
                for (let j = 0; j < segmentInfo.edges.length; j++) {
                    const edge = segmentInfo.edges[j]
                    const entry = segmentEntryTime
                    const exit = segmentEntryTime + edge.travelTime
                    itin.push({
                        edgeId: edge.id || `${edge.from}-${edge.to}`,
                        fromId: segmentInfo.path[j],
                        toId: segmentInfo.path[j + 1],
                        entry,
                        exit,
                        tier: edge.routeTier || 2
                    })
                    segmentEntryTime = exit
                }
                if (s2.depMins !== null) {
                    let nextDep = s2.depMins
                    while (nextDep < segmentEntryTime) nextDep += 24 * 60
                    currentAbs = nextDep
                }
            }
        })
        return itin
    }

    const validate = () => {
        if (courses.length === 0) return null

        for (const c of courses) {
            const startMins = c.stops[0].depMins
            const endMins = c.stops[c.stops.length - 1].arrMins
            if (endMins - startMins > 11 * 60) {
                return { message: `Kurs ${c.id} trwa dłużej niż 11 godzin!`, conflictCourseId: c.id, conflictStopIndex: null }
            }
        }

        const firstCourse = courses[0]
        const lastCourse = courses[courses.length - 1]
        const firstDep = firstCourse.stops[0].depMins
        const lastArr = lastCourse.stops[lastCourse.stops.length - 1].arrMins

        if (lastArr - firstDep > 23 * 60) {
            return { message: `Pełny cykl dobowy wszystkich kursów przekracza 23 godziny! Zmniejsz liczbę kursów lub zacieśnij czasy.`, conflictCourseId: lastCourse.id, conflictStopIndex: null }
        }

        const firstCityId = firstCourse.stops[0].cityId
        const lastCityId = lastCourse.stops[lastCourse.stops.length - 1].cityId

        if (firstCityId !== lastCityId) {
            return { message: `Skład musi zamknąć cykl dobowy w punkcie startowym (${getCityById(firstCityId)?.name}). Dodaj kurs powrotny.`, conflictCourseId: lastCourse.id, conflictStopIndex: null }
        }

        const myItin = []
        courses.forEach(c => {
            getDetailedItinerary(c.stops).forEach(seg => {
                const stopIndex = c.stops.findIndex(s => s.cityId === seg.fromId)
                myItin.push({ ...seg, courseId: c.id, stopIndex })
            })
        })

        for (const seg of myItin) {
            const buffer = seg.tier === 1 ? (gameSettings?.bufferTier1 ?? 3) : (gameSettings?.bufferTier2 ?? 6)

            for (let h = 4; h <= 22; h++) {
                const govStart = h * 60 + 30
                if (isColliding(seg.entry, govStart, buffer)) {
                    return {
                        message: `Kolizja z pociągiem samorządowym na odcinku ${getCityById(seg.fromId)?.name} -> ${getCityById(seg.toId)?.name} (X:30).`,
                        conflictCourseId: seg.courseId,
                        conflictStopIndex: seg.stopIndex
                    }
                }
            }
        }

        for (const otherTS of trainsSets) {
            if (otherTS.id === trainSet.id) continue
            if (!otherTS.rozklad) continue

            const otherItin = getItineraryFromRozklad(otherTS.rozklad)
            for (const seg of myItin) {
                for (const oSeg of otherItin) {
                    if (seg.edgeId === oSeg.edgeId && seg.fromId === oSeg.fromId) {
                        const buffer = seg.tier === 1 ? (gameSettings?.bufferTier1 ?? 3) : (gameSettings?.bufferTier2 ?? 6)
                        if (isColliding(seg.entry, oSeg.entry, buffer)) {
                            return {
                                message: `Kolizja ze składem ${otherTS.name} na odcinku ${getCityById(seg.fromId)?.name} -> ${getCityById(seg.toId)?.name} ok. godziny ${minsToTime(oSeg.entry)}.`,
                                conflictCourseId: seg.courseId,
                                conflictStopIndex: seg.stopIndex
                            }
                        }
                    }
                }
            }
        }

        return null
    }

    const serializeRozklad = () => {
        const out = []
        courses.forEach(c => {
            const terminalCity = getCityById(c.stops[c.stops.length - 1].cityId)?.name
            c.stops.forEach((s) => {
                out.push({
                    miasto: getCityById(s.cityId)?.name,
                    kurs: c.id.toString(),
                    odjazd: s.departure,
                    przyjazd: s.arrival,
                    kierunek: terminalCity
                })
            })
        })
        return out
    }

    const handleSave = async () => {
        const error = validate()
        if (error) {
            setValidationError(error.message)
            if (error.conflictCourseId != null) {
                setActiveCourseId(error.conflictCourseId)
            }
            if (error.conflictStopIndex != null) {
                setHighlightedStop({ courseId: error.conflictCourseId, stopIndex: error.conflictStopIndex })
            }
            return
        }

        const flatRozklad = serializeRozklad()

        const allSegments = new Set()
        courses.forEach(c => {
            getDetailedItinerary(c.stops).forEach(seg => {
                if (seg.edgeId) allSegments.add(seg.edgeId)
            })
        })
        const assignedRoutes = Array.from(allSegments)

        await saveTrainRoute(trainSet.id, trainSet.routeStops, flatRozklad, assignedRoutes, compSpeed)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
    }

    return {
        courses,
        activeCourseId,
        setActiveCourseId,
        validationError,
        saveSuccess,
        highlightedStop,
        handleAddCourse,
        handleRemoveLastCourse,
        handleTimeChange,
        handleSave,
        compSpeed,
    }
}
