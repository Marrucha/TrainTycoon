/**
 * useLiveBalanceUpdate
 *
 * Co wirtualną minutę oblicza przychód z pasażerów wsiadających w tej minucie
 * (tylko departures z bieżącej minuty) i dodaje go do finance.balance w Firebase.
 *
 * Mechanizm:
 * - Śledzi poprzednią minutę (prevMinRef).
 * - Gdy gameTimeMin zmienia się o 1 (lub więcej po batch), przetwarza każdą
 *   nową minutę oddzielnie i sumuje przychody.
 * - Wysyła jeden update do Firestore z łączną kwotą.
 * - Używa transakcji Firestore (runTransaction) żeby uniknąć race conditions.
 *
 * Ograniczenia / założenia:
 * - Działa tylko dla zalogowanego gracza (uid z auth).
 * - Nie duplikuje zapisów — aktualizuje tylko nowe minuty od ostatniego ticka.
 * - Przy rollover (nowy dzień gry = gameTimeMin spada do 0) reset ref.
 */

import { useEffect, useRef } from 'react'
import { runTransaction, doc } from 'firebase/firestore'
import { db, auth } from '../firebase/config'

// Ticket pricing helpers (duplicate-free — same logic as useBoardingSimulation)
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
    if (remaining > 0) cumulative += (remaining / 100) * basePer100km * mults[mults.length - 1]
    return Math.round(cumulative * 100) / 100
}

function ticketPriceForPair(fromId, toId, pricing, citiesById, cls) {
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
    const base = cls === 1 ? (pricing?.class1Per100km ?? 10) : (pricing?.class2Per100km ?? 6)
    const mults = pricing?.multipliers ?? [1.0, 0.9, 0.8, 0.7, 0.65, 0.6]
    return calcTicketPrice(dist, base, mults)
}

function timeToMin(t) {
    if (!t) return -1
    const parts = t.split(':')
    if (parts.length < 2) return -1
    return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

function minToStr(min) {
    const h = Math.floor(min / 60) % 24
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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

/**
 * Oblicza łączny przychód z boardingu dla jednej minuty (minuteStr = 'HH:MM')
 * na podstawie aktualnego stanu dailyDemand wszystkich składów.
 *
 * Nie mutuje stanu — jest to tylko kalkulacja dla celów finansowych.
 */
function calcRevenueForMinute(minuteStr, trainsSets, citiesById, trains, defaultPricing) {
    const FALLBACK = { class1Per100km: 10, class2Per100km: 6, multipliers: [1.0, 0.9, 0.8, 0.7, 0.65, 0.6] }
    let totalRevenue = 0

    for (const ts of (trainsSets || [])) {
        const crew = ts.crew || {}
        if (!crew.maszynista || !crew.kierownik) continue
        if (ts.speedMismatchBlock) continue
        const pricing = ts.pricing ?? defaultPricing ?? FALLBACK
        if (!pricing?.class2Per100km) continue
        if (!ts.dailyDemand || Object.keys(ts.dailyDemand).length === 0) continue
        if (!ts.rozklad?.length) continue

        const resolveCityId = (miasto) =>
            Object.values(citiesById).find(c => c.id === miasto || c.name === miasto)?.id ?? miasto

        // Group rozklad by kurs
        const kursGroups = {}
        for (const stop of ts.rozklad) {
            const k = String(stop.kurs ?? '_')
            if (!kursGroups[k]) kursGroups[k] = []
            kursGroups[k].push(stop)
        }

        const seatCaps = calcTotalSeats(ts, trains)
        const gapowiczeRate = ts.gapowiczeRate ?? 0

        // Snapshot demand for this minute's calculations
        const demandSnapshot = {}
        for (const [kId, kd] of Object.entries(ts.dailyDemand)) {
            demandSnapshot[kId] = { ...kd, od: { ...kd.od } }
        }

        // For each kurs, check if this minute is a departure
        for (const [kursId, stops] of Object.entries(kursGroups)) {
            const sorted = [...stops].sort((a, b) =>
                timeToMin(a.odjazd ?? a.przyjazd) - timeToMin(b.odjazd ?? b.przyjazd)
            )
            const resolvedIds = sorted.map(s => resolveCityId(s.miasto))

            for (let i = 0; i < sorted.length - 1; i++) {
                const stop = sorted[i]
                const depStr = stop.odjazd
                if (depStr !== minuteStr) continue  // only process this exact minute

                const cityId = resolvedIds[i]
                const forwardIds = new Set(resolvedIds.slice(i + 1))

                // Calculate how many passengers board here
                const odDemand = demandSnapshot[kursId]?.od || {}

                // Count current on-board (simplified — assume 0 as we process departure events only)
                // For revenue calculation we approximate: if seats available, board from demand
                const fwd = {}
                for (const [k, v] of Object.entries(odDemand)) {
                    if (!k.startsWith(cityId + ':')) continue
                    const toId = k.includes(':') ? k.split(':')[1] : ''
                    if (forwardIds.has(toId)) fwd[k] = v
                }

                const waitingC1 = Object.values(fwd).reduce((s, v) => s + (v.class1 ?? 0), 0)
                const waitingC2 = Object.values(fwd).reduce((s, v) => s + (v.class2 ?? 0), 0)
                if (waitingC1 <= 0 && waitingC2 <= 0) continue

                // Conservative: assume seats fully available at departure (will re-sync daily)
                const capC1 = seatCaps.class1
                const capC2 = seatCaps.class2

                const ratioC1 = waitingC1 > 0 ? Math.min(1.0, capC1 / waitingC1) : 0
                const ratioC2 = waitingC2 > 0 ? Math.min(1.0, capC2 / waitingC2) : 0
                const payFactor = 1.0 - gapowiczeRate

                for (const [key, val] of Object.entries(fwd)) {
                    const c1 = val.class1 ?? 0
                    const c2 = val.class2 ?? 0
                    const b1 = Math.min(Math.round(c1 * ratioC1), capC1)
                    const b2 = Math.min(Math.round(c2 * ratioC2), capC2)
                    if (b1 + b2 === 0) continue

                    const [fromId, toId] = key.split(':')
                    const p1 = ticketPriceForPair(fromId, toId, pricing, citiesById, 1)
                    const p2 = ticketPriceForPair(fromId, toId, pricing, citiesById, 2)
                    totalRevenue += b1 * p1 * payFactor + b2 * p2 * payFactor
                }
            }
        }
    }

    return Math.round(totalRevenue)
}


export function useLiveBalanceUpdate({ trainsSets, cities, trains, gameTimeMin, defaultPricing }) {
    const prevMinRef = useRef(-1)
    const updateInProgressRef = useRef(false)

    useEffect(() => {
        if (!trainsSets?.length || !cities?.length || gameTimeMin < 0) return

        const uid = auth.currentUser?.uid
        if (!uid) return

        const prevMin = prevMinRef.current

        // Day rollover — reset tracking
        if (prevMin > gameTimeMin + 30) {
            prevMinRef.current = gameTimeMin
            return
        }

        // First run — just record current minute, don't process history
        if (prevMin < 0) {
            prevMinRef.current = gameTimeMin
            return
        }

        // Already up to date
        if (gameTimeMin <= prevMin) return

        // Prevent concurrent updates
        if (updateInProgressRef.current) return
        updateInProgressRef.current = true

        const citiesById = Object.fromEntries(cities.map(c => [c.id, c]))

        // Collect all new minutes since last tick
        const newMinutes = []
        for (let m = prevMin + 1; m <= gameTimeMin; m++) {
            newMinutes.push(minToStr(m))
        }

        // Update prevMin immediately to avoid reprocessing on re-renders
        prevMinRef.current = gameTimeMin

        // Calculate total revenue for all new minutes
        let totalNewRevenue = 0
        for (const minuteStr of newMinutes) {
            totalNewRevenue += calcRevenueForMinute(minuteStr, trainsSets, citiesById, trains, defaultPricing)
        }

        if (totalNewRevenue <= 0) {
            updateInProgressRef.current = false
            return
        }

        // Atomic balance update via transaction
        const playerRef = doc(db, 'players', uid)
        runTransaction(db, async (transaction) => {
            const snap = await transaction.get(playerRef)
            const currentBalance = (snap.data()?.finance?.balance) ?? 0
            transaction.update(playerRef, {
                'finance.balance': currentBalance + totalNewRevenue,
            })
        })
            .catch(err => console.error('[LiveBalance] Transaction failed:', err))
            .finally(() => {
                updateInProgressRef.current = false
            })

    }, [gameTimeMin, trainsSets, cities, trains, defaultPricing])
}
