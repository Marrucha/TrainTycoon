/**
 * useBoardingSimulation — JavaScript port of boarding_sim.py's _process_stop_event.
 *
 * Runs the full boarding simulation from 00:00 up to `gameTimeMin` for every
 * trainSet.  The backend no longer writes currentTransfer every minute; this
 * hook is the single source of truth for intraday passenger state.
 *
 * Input:
 *   trainsSets  — from Firestore (contain dailyDemand, rozklad, crew, pricing, trainIds)
 *   cities      — array of city objects {id, name, lat, lon}
 *   trains      — merged playerTrains + baseTrains from GameContext
 *   gameTimeMin — current virtual game time in minutes (0–1439), stable per-minute
 *
 * Output: { [tsId]: { currentTransfer, transferredToday, remainingDemand } }
 *   currentTransfer  — mirrors backend currentTransfer structure (onBoard, totalOnBoard, …)
 *   transferredToday — mirrors backend dailyTransfer structure (od, total, revenue, …)
 *   remainingDemand  — mirrors backend dailyDemand structure after boarding so far
 */

import { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Ticket pricing helpers (port of tickets_pricing.py)
// ---------------------------------------------------------------------------

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0
    const dlat = (lat2 - lat1) * Math.PI / 180
    const dlon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dlat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2
    return R * 2 * Math.asin(Math.sqrt(a))
}

function calcTicketPrice(distKm, basePer100km, multipliers) {
    const mults = (multipliers && multipliers.length) ? multipliers : [1.0]
    let cumulative = 0
    let remaining = distKm
    for (const mult of mults) {
        const segment = Math.min(remaining, 100)
        cumulative += (segment / 100) * basePer100km * mult
        remaining -= segment
        if (remaining <= 0) break
    }
    if (remaining > 0) {
        cumulative += (remaining / 100) * basePer100km * mults[mults.length - 1]
    }
    return Math.round(cumulative * 100) / 100
}

function ticketPriceForPair(fromId, toId, pricing, citiesById, cls) {
    // Check matrixOverrides
    const mo = pricing?.matrixOverrides || {}
    const keyAB = `${fromId}--${toId}`
    const keyBA = `${toId}--${fromId}`
    const ovKey = keyAB in mo ? keyAB : (keyBA in mo ? keyBA : null)
    if (ovKey) {
        const ov = mo[ovKey][cls === 1 ? 'class1' : 'class2']
        if (ov !== undefined) return Number(ov)
    }

    const cityA = citiesById[fromId]
    const cityB = citiesById[toId]
    if (!cityA || !cityB) return 0

    const dist = haversineKm(cityA.lat ?? 0, cityA.lon ?? 0, cityB.lat ?? 0, cityB.lon ?? 0)
    const base = cls === 1
        ? (pricing?.class1Per100km ?? 10)
        : (pricing?.class2Per100km ?? 6)
    const mults = pricing?.multipliers ?? [1.0, 0.9, 0.8, 0.7, 0.65, 0.6]
    return calcTicketPrice(dist, base, mults)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeToMin(t) {
    if (!t) return -1
    const parts = t.split(':')
    if (parts.length < 2) return -1
    return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

function deepCopyDemand(demand) {
    const out = {}
    for (const [kId, kd] of Object.entries(demand)) {
        const odCopy = {}
        for (const [odKey, odVal] of Object.entries(kd.od || {})) {
            odCopy[odKey] = { ...odVal }
        }
        out[kId] = { ...kd, od: odCopy }
    }
    return out
}

function calcTotalSeats(ts, trains) {
    const caps = { class1: 0, class2: 0 }
    for (const wagonId of (ts.trainIds || [])) {
        const wagon = trains.find(t => t.id === wagonId)
        if (!wagon) continue
        const clsVal = parseInt(wagon.class ?? 2)
        const seats = wagon.seats ?? 0
        if (clsVal === 1) caps.class1 += seats
        else caps.class2 += seats
    }
    if (caps.class1 === 0 && caps.class2 === 0) caps.class2 = 200
    return caps
}

// ---------------------------------------------------------------------------
// Core stop-event processor (port of _process_stop_event in boarding_sim.py)
// ---------------------------------------------------------------------------

function processStopEvent(evType, kursId, cityId, forwardIds, isLast, nextCityId, nowStr,
    seatCaps, dailyDemand, dailyTransfer, currentTransfer, citiesById, pricing, gapowiczeRate) {

    const kd = dailyDemand[kursId] || { od: {}, total: 0, class1: 0, class2: 0 }
    const odDemand = kd.od || {}

    if (!dailyTransfer[kursId]) dailyTransfer[kursId] = { od: {}, total: 0, class1: 0, class2: 0 }
    const kt = dailyTransfer[kursId]
    const odTransfer = kt.od || {}

    if (!currentTransfer[kursId]) currentTransfer[kursId] = { onBoard: {}, totalOnBoard: 0 }
    const kc = currentTransfer[kursId]
    const onBoard = kc.onBoard || {}

    // ---- ALIGHT ----
    for (const key of Object.keys(onBoard)) {
        const destId = key.includes(':') ? key.split(':')[1] : ''
        if (destId === cityId) {
            const val = onBoard[key]
            delete onBoard[key]
            if (!odTransfer[key]) odTransfer[key] = { class1: 0, class2: 0 }
            odTransfer[key].class1 += val.class1 ?? 0
            odTransfer[key].class2 += val.class2 ?? 0
        }
    }

    // ---- BOARD (departure events only) ----
    if (evType === 'depart' && !isLast && forwardIds.size > 0) {
        const totalOnC1 = Object.values(onBoard).reduce((s, v) => s + (v.class1 ?? 0), 0)
        const totalOnC2 = Object.values(onBoard).reduce((s, v) => s + (v.class2 ?? 0), 0)
        const capC1 = Math.max(0, seatCaps.class1 - totalOnC1)
        const capC2 = Math.max(0, seatCaps.class2 - totalOnC2)

        // Find waiting passengers at this city going to forward destinations
        const fwd = {}
        for (const [k, v] of Object.entries(odDemand)) {
            if (!k.startsWith(cityId + ':')) continue
            const toId = k.includes(':') ? k.split(':')[1] : ''
            if (forwardIds.has(toId)) fwd[k] = v
        }

        const waitingC1 = Object.values(fwd).reduce((s, v) => s + (v.class1 ?? 0), 0)
        const waitingC2 = Object.values(fwd).reduce((s, v) => s + (v.class2 ?? 0), 0)

        if ((waitingC1 > 0 && capC1 > 0) || (waitingC2 > 0 && capC2 > 0)) {
            const ratioC1 = waitingC1 > 0 ? Math.min(1.0, capC1 / waitingC1) : 0
            const ratioC2 = waitingC2 > 0 ? Math.min(1.0, capC2 / waitingC2) : 0
            let remC1 = capC1
            let remC2 = capC2

            for (const [key, val] of Object.entries(fwd)) {
                if (remC1 <= 0 && remC2 <= 0) break

                const c1 = val.class1 ?? 0
                const c2 = val.class2 ?? 0
                let b1 = remC1 > 0 ? Math.round(c1 * ratioC1) : 0
                let b2 = remC2 > 0 ? Math.round(c2 * ratioC2) : 0
                b1 = Math.min(b1, remC1)
                b2 = Math.min(b2, remC2)
                if (b1 + b2 === 0) continue

                const [fromId, toId] = key.split(':')
                const p1 = ticketPriceForPair(fromId, toId, pricing, citiesById, 1)
                const p2 = ticketPriceForPair(fromId, toId, pricing, citiesById, 2)
                const payFactor = 1.0 - (gapowiczeRate ?? 0)
                const revC1 = b1 * p1 * payFactor
                const revC2 = b2 * p2 * payFactor

                kt.revenueC1 = (kt.revenueC1 ?? 0) + revC1
                kt.revenueC2 = (kt.revenueC2 ?? 0) + revC2
                kt.revenue = (kt.revenue ?? 0) + revC1 + revC2

                if (!onBoard[key]) onBoard[key] = { class1: 0, class2: 0 }
                onBoard[key].class1 += b1
                onBoard[key].class2 += b2
                odDemand[key] = { class1: Math.max(0, c1 - b1), class2: Math.max(0, c2 - b2) }

                remC1 -= b1
                remC2 -= b2
            }
        }
    }

    // ---- UPDATE currentTransfer ----
    const totalOnNew = Object.values(onBoard).reduce((s, v) => s + (v.class1 ?? 0) + (v.class2 ?? 0), 0)
    const status = isLast ? 'finished' : evType === 'arrive' ? 'at_station' : 'en_route'

    currentTransfer[kursId] = {
        onBoard: status === 'finished' ? {} : { ...onBoard },
        totalOnBoard: status === 'finished' ? 0 : totalOnNew,
        lastStation: cityId,
        nextStation: status === 'en_route' ? nextCityId : null,
        status,
        updatedAt: nowStr,
    }

    // ---- Recompute dailyDemand totals ----
    const dC1 = Object.values(odDemand).reduce((s, v) => s + (v.class1 ?? 0), 0)
    const dC2 = Object.values(odDemand).reduce((s, v) => s + (v.class2 ?? 0), 0)
    dailyDemand[kursId] = { ...kd, od: odDemand, total: dC1 + dC2, class1: dC1, class2: dC2 }

    // ---- Recompute dailyTransfer totals ----
    const tC1 = Object.values(odTransfer).reduce((s, v) => s + (v.class1 ?? 0), 0)
    const tC2 = Object.values(odTransfer).reduce((s, v) => s + (v.class2 ?? 0), 0)
    dailyTransfer[kursId] = {
        od: odTransfer,
        total: tC1 + tC2,
        class1: tC1,
        class2: tC2,
        revenue: kt.revenue ?? 0,
        revenueC1: kt.revenueC1 ?? 0,
        revenueC2: kt.revenueC2 ?? 0,
    }
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

const FALLBACK_PRICING = {
    class1Per100km: 10,
    class2Per100km: 6,
    multipliers: [1.0, 0.9, 0.8, 0.7, 0.65, 0.6],
}

export function useBoardingSimulation(trainsSets, cities, trains, gameTimeMin, defaultPricing) {
    return useMemo(() => {
        if (!cities?.length || gameTimeMin < 0) return {}

        const citiesById = Object.fromEntries(cities.map(c => [c.id, c]))
        const resolveCityId = (miasto) =>
            cities.find(c => c.id === miasto || c.name === miasto)?.id ?? miasto

        const result = {}

        for (const ts of (trainsSets || [])) {
            // Skip ineligible trainSets (mirrors backend skip conditions)
            const crew = ts.crew || {}
            if (!crew.maszynista || !crew.kierownik) continue
            if (ts.speedMismatchBlock) continue
            // Pricing: trainSet-level → player defaultPricing → built-in fallback
            const pricing = ts.pricing ?? defaultPricing ?? FALLBACK_PRICING
            if (!pricing?.class2Per100km) continue
            if (!ts.dailyDemand || Object.keys(ts.dailyDemand).length === 0) continue
            if (!ts.rozklad?.length) continue

            const demand = deepCopyDemand(ts.dailyDemand)
            const dailyTransfer = {}
            const currentTransfer = {}
            const seatCaps = calcTotalSeats(ts, trains)

            // Group rozklad by kurs
            const kursGroups = {}
            for (const stop of ts.rozklad) {
                const k = String(stop.kurs ?? '_')
                if (!kursGroups[k]) kursGroups[k] = []
                kursGroups[k].push(stop)
            }

            for (const [kursId, stops] of Object.entries(kursGroups)) {
                // Sort stops chronologically (use odjazd or przyjazd)
                const sorted = [...stops].sort((a, b) => {
                    const ta = timeToMin(a.odjazd ?? a.przyjazd)
                    const tb = timeToMin(b.odjazd ?? b.przyjazd)
                    return ta - tb
                })

                // Pre-resolve city IDs and forward sets
                const resolvedIds = sorted.map(s => resolveCityId(s.miasto))
                const stopData = sorted.map((stop, i) => ({
                    cityId: resolvedIds[i],
                    odjazd: stop.odjazd ?? null,
                    przyjazd: stop.przyjazd ?? null,
                    isFirst: i === 0,
                    isLast: i === sorted.length - 1,
                    forwardIds: new Set(resolvedIds.slice(i + 1)),
                    nextCityId: i < sorted.length - 1 ? resolvedIds[i + 1] : null,
                }))

                for (const sd of stopData) {
                    const arrMin = timeToMin(sd.przyjazd)
                    const depMin = timeToMin(sd.odjazd)

                    // Arrival: alight passengers
                    if (!sd.isFirst && arrMin >= 0 && arrMin <= gameTimeMin) {
                        processStopEvent(
                            'arrive', kursId, sd.cityId, sd.forwardIds, sd.isLast, sd.nextCityId,
                            sd.przyjazd,
                            seatCaps, demand, dailyTransfer, currentTransfer,
                            citiesById, pricing, ts.gapowiczeRate ?? 0,
                        )
                    }

                    // Departure: board passengers
                    if (!sd.isLast && depMin >= 0 && depMin <= gameTimeMin) {
                        processStopEvent(
                            'depart', kursId, sd.cityId, sd.forwardIds, sd.isLast, sd.nextCityId,
                            sd.odjazd,
                            seatCaps, demand, dailyTransfer, currentTransfer,
                            citiesById, pricing, ts.gapowiczeRate ?? 0,
                        )
                    }
                }
            }

            result[ts.id] = {
                currentTransfer,
                transferredToday: dailyTransfer,
                remainingDemand: demand,
            }
        }

        return result
    }, [trainsSets, cities, trains, gameTimeMin, defaultPricing])
}
