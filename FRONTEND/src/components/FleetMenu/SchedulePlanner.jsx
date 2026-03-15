import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../../context/GameContext'
import { findShortestPath } from '../../utils/dijkstra'
import styles from './SchedulePlanner.module.css'

function timeToMins(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function minsToTime(m) {
    const normalized = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(normalized / 60).toString().padStart(2, '0');
    const min = (normalized % 60).toString().padStart(2, '0');
    return `${h}:${min}`;
}

export default function SchedulePlanner({ trainSet, onClose }) {
    const { routes, cities, getCityById, saveTrainRoute, trainsSets, gameSettings } = useGame()

    // Lista kursów. Każdy kurs ma id, direction ('forward' | 'backward'), stops
    const [courses, setCourses] = useState([])
    const [activeCourseId, setActiveCourseId] = useState(1)
    const [validationError, setValidationError] = useState(null)

    // Helper: pobiera czas przejazdu z Dijkstry
    const getTravelTime = (cityA, cityB) => {
        const res = findShortestPath(routes, cityA, cityB, 'fastest');
        return res ? res.totalTime : 60; // fallback 60min
    };

    const getStopDuration = (cityId) => {
        const city = getCityById(cityId)
        const pop = city?.population ?? 0
        if (pop >= 500000) return 10
        if (pop >= 100000) return 5
        return 3
    }

    // Generuje obiekty postojów dla pojedynczego kursu
    const generateStops = (stopIds, startMins) => {
        let curr = startMins;
        const result = [];
        for (let i = 0; i < stopIds.length; i++) {
            const cityId = stopIds[i];
            if (i === 0) {
                result.push({
                    cityId, arrival: null, departure: minsToTime(curr),
                    travelFromPrev: 0, stopDuration: 0, arrMins: null, depMins: curr
                });
            } else {
                const prevId = stopIds[i - 1];
                const travel = getTravelTime(prevId, cityId);
                const arr = curr + travel;
                const stopD = i === stopIds.length - 1 ? 0 : getStopDuration(cityId);
                const dep = arr + stopD;
                curr = dep;
                result.push({
                    cityId, arrival: minsToTime(arr),
                    departure: i === stopIds.length - 1 ? null : minsToTime(dep),
                    travelFromPrev: travel, stopDuration: stopD, arrMins: arr, depMins: dep
                });
            }
        }
        return result;
    };

    // Inicjalizacja: załaduj istniejący rozkład, jeśli jest, a jeśli nie - generuj nowy
    useEffect(() => {
        if (!trainSet.routeStops || trainSet.routeStops.length < 2) return;

        if (trainSet.rozklad && trainSet.rozklad.length > 0) {
            const byKurs = {};
            for (const r of trainSet.rozklad) {
                if (!byKurs[r.kurs]) byKurs[r.kurs] = [];
                byKurs[r.kurs].push(r);
            }

            const parsedCourses = Object.keys(byKurs)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(kId => {
                    const kursStops = byKurs[kId];
                    const originName = kursStops[0].miasto;
                    const originCity = cities.find(c => c.name === originName);
                    const baseOriginId = trainSet.routeStops[0];
                    const direction = (originCity && originCity.id === baseOriginId) ? 'forward' : 'backward';

                    const stops = kursStops.map((s, idx) => {
                        const city = cities.find(c => c.name === s.miasto);
                        const cityId = city ? city.id : null;

                        const arrMins = s.przyjazd ? timeToMins(s.przyjazd) : null;
                        const depMins = s.odjazd ? timeToMins(s.odjazd) : null;

                        let travelFromPrev = 0;
                        if (idx > 0) {
                            const prev = kursStops[idx - 1];
                            const prevDep = prev.odjazd ? timeToMins(prev.odjazd) : 0;
                            travelFromPrev = arrMins - prevDep;
                            if (travelFromPrev < 0) travelFromPrev += 24 * 60;
                        }

                        let stopDuration = 0;
                        if (idx < kursStops.length - 1) {
                            stopDuration = depMins - arrMins;
                            if (stopDuration < 0) stopDuration += 24 * 60;
                        }

                        return {
                            cityId,
                            arrival: s.przyjazd,
                            departure: s.odjazd,
                            travelFromPrev,
                            stopDuration,
                            arrMins,
                            depMins
                        };
                    });

                    // Fix absolute minutes for continuous calculations
                    let cumulativeMins = stops[0].depMins;
                    stops[0].arrMins = null;
                    for (let i = 1; i < stops.length; i++) {
                        const travel = stops[i].travelFromPrev;
                        let targetArr = cumulativeMins + travel;
                        stops[i].arrMins = targetArr;

                        if (i < stops.length - 1) {
                            const stopDur = stops[i].stopDuration;
                            let targetDep = targetArr + stopDur;
                            stops[i].depMins = targetDep;
                            cumulativeMins = targetDep;
                        } else {
                            stops[i].depMins = null;
                        }
                    }

                    return {
                        id: parseInt(kId),
                        direction,
                        stops
                    };
                });
            setCourses(parsedCourses);
        } else {
            const c1Stops = generateStops(trainSet.routeStops, 8 * 60); // Start 08:00
            setCourses([{ id: 1, direction: 'forward', stops: c1Stops }]);
        }
        // eslint-disable-next-line
    }, [trainSet.routeStops, trainSet.rozklad, cities]);

    const handleAddCourse = () => {
        if (courses.length === 0) {
            const c1Stops = generateStops(trainSet.routeStops, 8 * 60)
            const newCourse = { id: 1, direction: 'forward', stops: c1Stops }
            setCourses([newCourse])
            setActiveCourseId(1)
            return
        }
        const lastCourse = courses[courses.length - 1];
        if (!lastCourse) return;

        const startMins = lastCourse.stops[lastCourse.stops.length - 1].arrMins + 60; // Min 1h postoju
        const newDirection = lastCourse.direction === 'forward' ? 'backward' : 'forward';

        const baseStops = trainSet.routeStops;
        const newStopIds = newDirection === 'forward' ? [...baseStops] : [...baseStops].reverse();

        const newStops = generateStops(newStopIds, startMins);

        setCourses([...courses, {
            id: lastCourse.id + 1,
            direction: newDirection,
            stops: newStops
        }]);
        setActiveCourseId(lastCourse.id + 1);
    };

    const handleRemoveLastCourse = () => {
        if (courses.length === 0) return
        const newCourses = courses.slice(0, -1)
        setCourses(newCourses)
        setActiveCourseId(newCourses.length > 0 ? newCourses[newCourses.length - 1].id : null)
    };

    const recalculateCoursesFrom = (courseIndex, stopIndex, newDepMins, explicitVal = null) => {
        const newCourses = JSON.parse(JSON.stringify(courses)); // Deep copy

        // Aktualizuj zmodyfikowany stop
        newCourses[courseIndex].stops[stopIndex].depMins = newDepMins;
        newCourses[courseIndex].stops[stopIndex].departure = explicitVal ? explicitVal : minsToTime(newDepMins);

        // Propaguj w dół aktualnego kursu
        for (let i = stopIndex + 1; i < newCourses[courseIndex].stops.length; i++) {
            const stop = newCourses[courseIndex].stops[i];
            const prevStop = newCourses[courseIndex].stops[i - 1];

            stop.arrMins = prevStop.depMins + stop.travelFromPrev;
            stop.arrival = minsToTime(stop.arrMins);

            if (i < newCourses[courseIndex].stops.length - 1) {
                stop.depMins = stop.arrMins + stop.stopDuration;
                stop.departure = minsToTime(stop.depMins);
            }
        }

        // Propaguj do rykoszetem do następnych kursów
        for (let c = courseIndex + 1; c < newCourses.length; c++) {
            const prevCourse = newCourses[c - 1];
            const prevEndArr = prevCourse.stops[prevCourse.stops.length - 1].arrMins;

            // Wymuś 1h przerwy
            const minAllowedDep = prevEndArr + 60;
            let currentDep = newCourses[c].stops[0].depMins;

            if (currentDep < minAllowedDep) {
                currentDep = minAllowedDep;
            }

            // Przelicz cały kurs c
            newCourses[c].stops[0].depMins = currentDep;
            newCourses[c].stops[0].departure = minsToTime(currentDep);

            for (let i = 1; i < newCourses[c].stops.length; i++) {
                const stop = newCourses[c].stops[i];
                const prevStop = newCourses[c].stops[i - 1];

                stop.arrMins = prevStop.depMins + stop.travelFromPrev;
                stop.arrival = minsToTime(stop.arrMins);

                if (i < newCourses[c].stops.length - 1) {
                    stop.depMins = stop.arrMins + stop.stopDuration;
                    stop.departure = minsToTime(stop.depMins);
                }
            }
        }

        setCourses(newCourses);
    };

    const handleTimeChange = (courseIndex, stopIndex, val) => {
        // Zezwól na wpisywanie formatu HH:mm z inputu HTML
        if (!val) return;
        const newMins = timeToMins(val);

        const newCourses = JSON.parse(JSON.stringify(courses));

        // Zamiast dodawać dyferencjały, potraktuj nową wartość jako "dzisiejszą/absolutną"
        // Ponieważ nie znamy daty, bezpiecznie wstawiamy po prostu bezwzględne minuty,
        // jednak trzeba obsłużyć przeskok przez północ, jeśli startuje kurs po północy.
        // Czas z pola input jest "w danym dniu od 00:00 do 23:59".
        // Szukamy najbliższego dopasowania na osi czasu względem poprzedniej wartości

        const oldAbsMins = newCourses[courseIndex].stops[stopIndex].depMins;
        const baseDayMins = Math.floor(oldAbsMins / (24 * 60)) * 24 * 60; // Dzień, na którym staliśmy

        let targetAbsMins = baseDayMins + newMins;

        // Jeśli nowa godzina (np 01:00 = 60) jest drastycznie mniejsza od starej (np 23:00 = 1380)
        // a różnica to np -1300, to prawdopodobnie gracz zamierza przejść na następny dzień
        if (targetAbsMins - oldAbsMins < -12 * 60) {
            targetAbsMins += 24 * 60;
        } else if (targetAbsMins - oldAbsMins > 12 * 60) {
            targetAbsMins -= 24 * 60;
        }

        // Odjazd nie może być wcześniej niż przyjazd + 3 minuty
        const arrMins = courses[courseIndex].stops[stopIndex].arrMins;
        if (arrMins !== null && arrMins !== undefined && targetAbsMins < arrMins + 3) {
            targetAbsMins = arrMins + 3;
        }

        recalculateCoursesFrom(courseIndex, stopIndex, targetAbsMins, minsToTime(targetAbsMins));
    };

    // Usuń błąd, gdy użytkownik modyfikuje rozkład
    useEffect(() => {
        if (validationError) setValidationError(null);
        // eslint-disable-next-line
    }, [courses]);

    const getDetailedItinerary = (courseStops) => {
        const itin = [];
        for (let i = 0; i < courseStops.length - 1; i++) {
            const startCityId = courseStops[i].cityId;
            const endCityId = courseStops[i + 1].cityId;
            const depTime = courseStops[i].depMins;

            const segment = findShortestPath(routes, startCityId, endCityId, 'fastest');
            if (!segment) continue;

            let currentTime = depTime;
            for (let j = 0; j < segment.edges.length; j++) {
                const edge = segment.edges[j];
                const entry = currentTime;
                const exit = currentTime + edge.travelTime;
                const fId = segment.path[j];
                const tId = segment.path[j + 1];

                itin.push({
                    edgeId: edge.id || `${edge.from}-${edge.to}`,
                    fromId: fId,
                    toId: tId,
                    entry,
                    exit,
                    tier: edge.routeTier || 2
                });
                currentTime = exit;
            }
        }
        return itin;
    };

    const getItineraryFromRozklad = (rozklad) => {
        const byKurs = {};
        rozklad.forEach(r => {
            if (!byKurs[r.kurs]) byKurs[r.kurs] = [];
            byKurs[r.kurs].push(r);
        });

        const itin = [];
        Object.values(byKurs).forEach(stops => {
            const stopsWithId = stops.map(s => ({
                cityId: cities.find(c => c.name === s.miasto)?.id,
                depMins: s.odjazd ? timeToMins(s.odjazd) : null,
            })).filter(s => s.cityId);
            
            if (stopsWithId.length < 2) return;
            let currentAbs = stopsWithId[0].depMins;
            for (let i = 0; i < stopsWithId.length - 1; i++) {
                const s1 = stopsWithId[i];
                const s2 = stopsWithId[i + 1];
                const segmentInfo = findShortestPath(routes, s1.cityId, s2.cityId, 'fastest');
                if (!segmentInfo) continue;
                
                let segmentEntryTime = currentAbs;
                for (let j = 0; j < segmentInfo.edges.length; j++) {
                    const edge = segmentInfo.edges[j];
                    const entry = segmentEntryTime;
                    const exit = segmentEntryTime + edge.travelTime;
                    itin.push({
                        edgeId: edge.id || `${edge.from}-${edge.to}`,
                        fromId: segmentInfo.path[j],
                        toId: segmentInfo.path[j+1],
                        entry,
                        exit,
                        tier: edge.routeTier || 2
                    });
                    segmentEntryTime = exit;
                }
                if (s2.depMins !== null) {
                    let nextDep = s2.depMins;
                    while (nextDep < segmentEntryTime) nextDep += 24 * 60;
                    currentAbs = nextDep;
                }
            }
        });
        return itin;
    };

    const isColliding = (entryA, entryB, buffer) => {
        const diff = Math.abs((entryA % 1440) - (entryB % 1440));
        const wrappedDiff = Math.min(diff, 1440 - diff);
        return wrappedDiff < buffer;
    };

    // Walidacja obostrzeń uruchamiana dopiero przy próbie zapisu/publikacji
    const validate = () => {
        if (courses.length === 0) return null;

        for (const c of courses) {
            const startMins = c.stops[0].depMins;
            const endMins = c.stops[c.stops.length - 1].arrMins;
            if (endMins - startMins > 11 * 60) {
                return `Kurs ${c.id} trwa dłużej niż 11 godzin!`;
            }
        }

        const firstCourse = courses[0];
        const lastCourse = courses[courses.length - 1];
        const firstDep = firstCourse.stops[0].depMins;
        const lastArr = lastCourse.stops[lastCourse.stops.length - 1].arrMins;

        if (lastArr - firstDep > 23 * 60) {
            return `Pełny cykl dobowy wszystkich kursów przekracza 23 godziny! Zmniejsz liczbę kursów lub zacieśnij czasy.`;
        }

        const firstCityId = firstCourse.stops[0].cityId;
        const lastCityId = lastCourse.stops[lastCourse.stops.length - 1].cityId;

        if (firstCityId !== lastCityId) {
            return `Skład musi zamknąć cykl dobowy w punkcie startowym (${getCityById(firstCityId)?.name}). Dodaj kurs powrotny.`;
        }

        // --- DETEKCJA KOLIZJI ---
        const myItin = [];
        courses.forEach(c => myItin.push(...getDetailedItinerary(c.stops)));

        // 1. Kolizja z pociągami samorządowymi (każde X:30 z każdego miasta)
        for (const seg of myItin) {
            const buffer = seg.tier === 1 ? (gameSettings?.bufferTier1 ?? 3) : (gameSettings?.bufferTier2 ?? 6);
            
            for (let h = 0; h < 24; h++) {
                const govStart = h * 60 + 30;
                if (isColliding(seg.entry, govStart, buffer)) {
                    return `Kolizja z pociągiem samorządowym na odcinku ${getCityById(seg.fromId)?.name} -> ${getCityById(seg.toId)?.name} (X:30).`;
                }
            }
        }

        // 2. Kolizja z innymi składami graczy
        for (const otherTS of trainsSets) {
            if (otherTS.id === trainSet.id) continue;
            if (!otherTS.rozklad) continue;

            const otherItin = getItineraryFromRozklad(otherTS.rozklad);
            for (const seg of myItin) {
                for (const oSeg of otherItin) {
                    if (seg.edgeId === oSeg.edgeId && seg.fromId === oSeg.fromId) {
                        const buffer = seg.tier === 1 ? (gameSettings?.bufferTier1 ?? 3) : (gameSettings?.bufferTier2 ?? 6);
                        if (isColliding(seg.entry, oSeg.entry, buffer)) {
                            return `Kolizja ze składem ${otherTS.name} na odcinku ${getCityById(seg.fromId)?.name} -> ${getCityById(seg.toId)?.name} ok. godziny ${minsToTime(oSeg.entry)}.`;
                        }
                    }
                }
            }
        }

        return null;
    };

    // Konwertowanie struktury domeny wewnętrznej (courses) na structure DB bazową rozkladu
    const serializeRozklad = () => {
        const out = [];
        courses.forEach(c => {
            const terminalCity = getCityById(c.stops[c.stops.length - 1].cityId)?.name;
            c.stops.forEach((s) => {
                out.push({
                    miasto: getCityById(s.cityId)?.name,
                    kurs: c.id.toString(),
                    odjazd: s.departure,
                    przyjazd: s.arrival,
                    kierunek: terminalCity
                });
            });
        });
        return out;
    };

    const handleSave = async () => {
        const error = validate();
        if (error) {
            setValidationError(error);
            return;
        }

        const flatRozklad = serializeRozklad();
        await saveTrainRoute(trainSet.id, trainSet.routeStops, flatRozklad);
        onClose();
    };


    const activeCourse = courses.find(c => c.id === activeCourseId);

    return createPortal(
        <div className={styles.overlay}>
            <header className={styles.header}>
                <h2>Harmonogram: {trainSet.name}</h2>
                <button className={styles.closeBtn} onClick={onClose}>Zamknij</button>
            </header>

            <div className={styles.content}>
                <div className={styles.sidebar}>
                    <div className={styles.sectionTitle}>Cykle Dobowe (Kursy)</div>
                    <div className={styles.infoBox}>
                        <p>Zarządzaj kursami pociągu w przód i w tył na tej trasie.</p>
                        <p><strong>Limity przypomnienie:</strong></p>
                        <p>- Max 11h na pojedynczy kurs</p>
                        <p>- Min 1h postoju na obrócenie składu w terminalu</p>
                        <p>- Kółko musi zamknąć się w punkcie startowym w max 23h</p>
                    </div>

                    <div className={styles.coursesList}>
                        {courses.map(c => {
                            const origin = getCityById(c.stops[0].cityId)?.name;
                            const dest = getCityById(c.stops[c.stops.length - 1].cityId)?.name;
                            return (
                                <button
                                    key={c.id}
                                    className={`${styles.courseBtn} ${c.id === activeCourseId ? styles.active : ''}`}
                                    onClick={() => setActiveCourseId(c.id)}
                                >
                                    Kurs {c.id}: {origin} ➔ {dest}
                                </button>
                            );
                        })}
                        <button
                            className={styles.addCourseBtn}
                            onClick={handleAddCourse}
                        >
                            {courses.length === 0 ? '+ Dodaj Pierwszy Kurs' : '+ Dodaj Kurs Powrotny'}
                        </button>
                        {courses.length > 0 && (
                            <button
                                className={styles.addCourseBtn}
                                style={{ color: '#e74c3c', borderColor: '#e74c3c' }}
                                onClick={handleRemoveLastCourse}
                            >
                                - Usuń Ostatni
                            </button>
                        )}
                    </div>

                    <div className={styles.actionPanel}>
                        <button className={styles.submitBtn} onClick={handleSave}>
                            Zapisz Rozkład
                        </button>
                    </div>
                </div>

                <div className={styles.mainArea}>
                    {validationError && (
                        <div className={styles.errorBox}>
                            <span className={styles.errorIcon}>⚠️</span>
                            <span>{validationError}</span>
                        </div>
                    )}

                    {activeCourse && (
                        <div className={styles.timeline}>
                            <div className={styles.sectionTitle} style={{ marginBottom: '20px' }}>Szczegóły Kursu {activeCourse.id}</div>

                            <div className={styles.timelineHeader}>
                                <div className={styles.colStation}>Stacja</div>
                                <div className={styles.colArr}>Przyjazd</div>
                                <div className={styles.colDep}>Odjazd</div>
                                <div className={styles.colTravel}>Czas przejazdu</div>
                            </div>

                            {activeCourse.stops.map((stop, sIdx) => {
                                const city = getCityById(stop.cityId);
                                const isTerminal = sIdx === activeCourse.stops.length - 1;
                                const isOrigin = sIdx === 0;
                                const courseIndex = courses.findIndex(c => c.id === activeCourse.id);

                                return (
                                    <div key={stop.cityId} className={styles.timelineRow}>
                                        <div className={styles.colStation}>
                                            <span className={`${styles.stationName} ${isTerminal || isOrigin ? styles.stationTerminal : ''}`}>
                                                {city?.name}
                                            </span>
                                        </div>
                                        <div className={styles.colArr}>
                                            <span>{stop.arrival || '—'}</span>
                                        </div>
                                        <div className={styles.colDep}>
                                            {isTerminal ? (
                                                <span>—</span>
                                            ) : (
                                                <input
                                                    type="time"
                                                    className={styles.timeInput}
                                                    value={stop.departure}
                                                    onChange={(e) => handleTimeChange(courseIndex, sIdx, e.target.value)}
                                                />
                                            )}
                                        </div>
                                        <div className={styles.colTravel}>
                                            {isOrigin ? (
                                                <span className={styles.travelTime}>—</span>
                                            ) : (
                                                <span className={styles.travelTime}>+{stop.travelFromPrev} min</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
