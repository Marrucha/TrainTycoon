import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { INITIAL_BUDGET } from '../data/gameData'
import { timeToMin } from '../components/Map/modules/MapUtils'
import { useFirestoreData } from './hooks/useFirestoreData'
import { useSelectionState } from './hooks/useSelectionState'
import { useTrainActions } from './hooks/useTrainActions'
import { useFinanceActions } from './hooks/useFinanceActions'
import { useScheduleActions } from './hooks/useScheduleActions'

const GameContext = createContext(null)

export const DEFAULT_PRICE_CONFIG = {
  class1Per100km: 10,
  class2Per100km: 6,
  multipliers: [1.0, 0.9, 0.8, 0.7, 0.65, 0.6],
}

export function GameProvider({ children }) {
  const firestoreData = useFirestoreData()
  const { baseTrains, playerTrains, trainsSets, routes, cities, playerDoc, gameSettings, pictures, deposits, depositRates, loading } = firestoreData

  const selection = useSelectionState()
  const { selectedCity, selectedRoute, selectedTrainSet, selectCity, selectRoute, selectTrainSet } = selection

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  const gameTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const budget = playerDoc.finance?.balance ?? INITIAL_BUDGET
  const companyName = playerDoc.companyName ?? ''
  const reputation = playerDoc.reputation ?? 0.5

  const defaultPricing = useMemo(
    () => playerDoc.defaultPricing ?? DEFAULT_PRICE_CONFIG,
    [playerDoc]
  )

  const trains = useMemo(() => {
    return playerTrains.map(pt => {
      const baseModel = baseTrains.find(bt => bt.id === pt.parent_id) || {}
      return { ...baseModel, id: pt.id, parent_id: pt.parent_id }
    })
  }, [baseTrains, playerTrains])

  const dailyRevenue = useMemo(
    () => routes.reduce((sum, r) => sum + (r.dailyRevenue || 0) + (r.subsidy || 0), 0),
    [routes]
  )

  const activeTrainsCount = useMemo(
    () => new Set(routes.filter(r => r.trainId).map(r => r.trainId)).size,
    [routes]
  )

  // Mapa cityId → [ts, ...] — identyczna logika jak trainPositions + trainCountsAtCities w useMapData
  const trainSetsByCity = useMemo(() => {
    const result = {}
    if (!trainsSets?.length || !cities?.length) return result
    const currentMin = timeToMin(gameTime)
    if (currentMin < 0) return result

    const resolveCityId = (miasto) =>
      cities.find(c => c.id === miasto || c.name === miasto)?.id

    trainsSets.forEach(ts => {
      if (!ts.rozklad?.length) return

      // Per kurs — identycznie jak trainPositions
      const byKurs = {}
      ts.rozklad.forEach(s => {
        const k = s.kurs ?? '_'
        if (!byKurs[k]) byKurs[k] = []
        byKurs[k].push(s)
      })

      let isMoving = false
      for (const kursStops of Object.values(byKurs)) {
        for (let i = 0; i < kursStops.length - 1; i++) {
          const depMin = timeToMin(kursStops[i].odjazd)
          const arrMin = timeToMin(kursStops[i + 1].przyjazd || kursStops[i + 1].odjazd)
          if (depMin < 0 || arrMin < 0) continue
          const onSegment = depMin <= arrMin
            ? currentMin >= depMin && currentMin <= arrMin
            : currentMin >= depMin || currentMin <= arrMin
          if (onSegment) { isMoving = true; break }
        }
        if (isMoving) break
      }
      if (isMoving) return

      // Gdzie stoi — identycznie jak trainCountsAtCities
      const stops = ts.rozklad
        .map(s => ({
          cityId: resolveCityId(s.miasto),
          time: timeToMin(s.odjazd) >= 0 ? timeToMin(s.odjazd) : timeToMin(s.przyjazd),
        }))
        .filter(s => s.cityId && s.time >= 0)
        .sort((a, b) => a.time - b.time)

      if (stops.length === 0) return

      let currentStop = null
      for (let i = stops.length - 1; i >= 0; i--) {
        if (stops[i].time <= currentMin) { currentStop = stops[i]; break }
      }
      if (!currentStop) currentStop = stops[stops.length - 1]

      const cityId = currentStop.cityId
      if (!result[cityId]) result[cityId] = []
      result[cityId].push(ts)
    })

    return result
  }, [trainsSets, cities, gameTime])

  const trainActions = useTrainActions({ baseTrains, budget })
  const financeActions = useFinanceActions({ budget, playerDoc })
  const scheduleActions = useScheduleActions({ cities, trainsSets, setSelectedRoute: selection.setSelectedRoute })

  function getTrainById(id) {
    return trains.find(t => t.id === id) || null
  }

  function getCityById(id) {
    return cities.find(c => c.id === id) || null
  }

  function getDemandForRoute(route) {
    const fromCity = cities.find(c => c.id === route.from)
    return fromCity?.demand?.[route.to] ?? 0
  }

  function getTicketPrice(trainSetId) {
    const ts = trainsSets.find(t => t.id === trainSetId)
    return ts?.pricing ?? defaultPricing
  }

  async function updateDefaultPricing(config) {
    try {
      await setDoc(doc(db, 'players', 'player1'), { defaultPricing: config }, { merge: true })
    } catch (e) {
      console.error('Błąd aktualizacji globalnego cennika:', e)
    }
  }

  function getDeparturesForCity(cityId) {
    const city = getCityById(cityId)
    if (!city?.rozklad?.length) return []
    return [...city.rozklad]
      .filter(entry => {
        const destCity = cities.find(c => c.name === entry.destination || c.id === entry.destination)
        return !destCity || destCity.id !== cityId
      })
      .sort((a, b) => a.departure.localeCompare(b.departure))
      .map((entry, i) => ({
        id: `${entry.trainSetId}-${entry.kurs}-${entry.departure}`,
        trainSetId: entry.trainSetId,
        destination: entry.destination,
        departure: entry.departure,
        platform: (i % 6) + 1,
        trainId: entry.trainName,
        trainType: entry.trainType,
        trainNo: entry.trainNo ?? null,
        kurs: entry.kurs ?? null,
        via: (entry.via || []).map(v => cities.find(c => c.id === v || c.name === v)?.name || v),
        status: 'ON TIME',
      }))
  }

  return (
    <GameContext.Provider value={{
      // Dane
      budget, trains, trainsSets, routes, cities, loading, gameTime,
      baseTrains, gameSettings, pictures, playerDoc,
      deposits, depositRates,
      // Pochodne
      dailyRevenue, activeTrainsCount, defaultPricing, trainSetsByCity,
      companyName, reputation,
      // Selekcja
      selectedCity, selectedRoute, selectedTrainSet,
      selectCity, selectRoute, selectTrainSet,
      // Akcje pociągów
      ...trainActions,
      // Akcje finansowe
      ...financeActions,
      // Akcje rozkładów
      ...scheduleActions,
      // Helpery
      getTrainById, getCityById, getDemandForRoute,
      getTicketPrice, updateDefaultPricing, getDeparturesForCity,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
