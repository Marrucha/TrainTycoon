import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useBoardingSimulation } from '../hooks/useBoardingSimulation'
import { doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../firebase/config'
import { INITIAL_BUDGET } from '../data/gameData'
import { timeToMin } from '../components/Map/modules/MapUtils'
import { useFirestoreData } from './hooks/useFirestoreData'
import { useSelectionState } from './hooks/useSelectionState'
import { useTrainActions } from './hooks/useTrainActions'
import { useFinanceActions } from './hooks/useFinanceActions'
import { useScheduleActions } from './hooks/useScheduleActions'
import { useHRActions } from './hooks/useHRActions'
import Onboarding from '../components/Onboarding/Onboarding'
import sunDataJson from '../data/sunTimes.json'

const GameContext = createContext(null)

export const DEFAULT_PRICE_CONFIG = {
  class1Per100km: 10,
  class2Per100km: 6,
  multipliers: [1.0, 0.9, 0.8, 0.7, 0.65, 0.6],
}

export function GameProvider({ children }) {
  const firestoreData = useFirestoreData()
  const { baseTrains, playerTrains, trainsSets, routes, cities, playerDoc, gameSettings, pictures, deposits, depositRates, employees, financeLedger, sunTimes, loading, hallOfFame, gameConstants, listedCompanies, myPortfolio } = firestoreData

  const selection = useSelectionState()
  const { selectedCity, selectedRoute, selectedTrainSet: selectedTrainSetRef, selectCity, selectRoute, selectTrainSet } = selection
  const selectedTrainSet = selectedTrainSetRef
    ? (trainsSets.find(ts => ts.id === selectedTrainSetRef.id) ?? selectedTrainSetRef)
    : null


  const REAL_START_TIME_MS = gameConstants?.REAL_START_TIME_MS
  const GAME_START_TIME_MS = gameConstants?.GAME_START_TIME_MS
  const TIME_MULTIPLIER = gameConstants?.TIME_MULTIPLIER || 30

  const [realNow, setRealNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setRealNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [])

  const virtualNowMs = (REAL_START_TIME_MS && GAME_START_TIME_MS) 
    ? GAME_START_TIME_MS + (realNow - REAL_START_TIME_MS) * TIME_MULTIPLIER
    : null

  const gameDate = useMemo(() => virtualNowMs ? new Date(virtualNowMs) : null, [virtualNowMs])
  
  // Bezpieczny fallback The Time (wymagany the The The the loading)
  const gameTime = gameDate ? `${String(gameDate.getHours()).padStart(2, '0')}:${String(gameDate.getMinutes()).padStart(2, '0')}` : '--:--'

  // Tymczasowy upload danych słonecznych wygenerowanych w Pythonie skryptowo
  useEffect(() => {
    if (sunTimes && Object.keys(sunTimes).length === 0 && auth.currentUser) {
      setDoc(doc(db, 'gameConfig', 'sunTimes'), sunDataJson).catch(console.error)
    }
  }, [sunTimes])

  // Automatyczna naprawa jeśli brakuje parametrów czasu w Constants
  useEffect(() => {
    if (gameConstants && auth.currentUser && !gameConstants.REAL_START_TIME_MS) {
      const nowMs = Date.now()
      setDoc(doc(db, 'gameConfig', 'constants'), {
        REAL_START_TIME_MS: nowMs,
        GAME_START_TIME_MS: nowMs,
        TIME_MULTIPLIER: 30
      }, { merge: true }).catch(console.error)
    }
  }, [gameConstants])
  useEffect(() => {
    if (gameConstants && Object.keys(gameConstants).length === 0 && auth.currentUser) {
      const defaultConstants = {
        SALARIES: { maszynista: 9000, kierownik: 7000, pomocnik: 6000, konduktor: 5000, barman: 4500 },
        EXP_SALARY_RATES: { maszynista: 100, pomocnik: 80, kierownik: 70, konduktor: 60, barman: 50 },
        INTERN_SALARY: 4300,
        AGENCY_FEE_MULTIPLIER: 6,
        ANNUAL_RATE: 0.06,
        COMMITMENT_RATE: 0.01,
        CLASS2_PER_100KM: 6,
        BASE_WARS_RATE: 20
      }
      setDoc(doc(db, 'gameConfig', 'constants'), defaultConstants, { merge: true }).catch(console.error)
    }
  }, [gameConstants])

  const savedBalance = playerDoc.finance?.balance ?? INITIAL_BUDGET
  const companyName = playerDoc.companyName ?? ''
  const reputation = playerDoc.reputation ?? 0.5

  const defaultPricing = useMemo(
    () => playerDoc.defaultPricing ?? DEFAULT_PRICE_CONFIG,
    [playerDoc]
  )

  const trains = useMemo(() => {
    return playerTrains.map(pt => {
      const baseModel = baseTrains.find(bt => bt.id === pt.parent_id) || {}
      return { ...baseModel, ...pt }
    })
  }, [baseTrains, playerTrains])

  const lastDailyReport = useMemo(() => {
    const entry = financeLedger.find(e => !e.id?.startsWith('monthly-'))
    if (!entry) return null
    const sum = obj => Object.values(obj || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
    const przychod = sum(entry.revenues)
    const koszty   = sum(entry.costs)
    return { przychod, koszty, netto: przychod - koszty }
  }, [financeLedger])

  const activeTrainsCount = useMemo(
    () => trainsSets?.filter(ts => ts.rozklad?.length > 0).length ?? 0,
    [trainsSets]
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
          time: timeToMin(s.przyjazd) >= 0 ? timeToMin(s.przyjazd) : timeToMin(s.odjazd),
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

  // Boarding simulation — runs in the browser for current player's trainSets.
  // gameTimeMin is stable per virtual minute, avoiding excessive re-renders.
  const gameTimeMin = gameDate ? gameDate.getHours() * 60 + gameDate.getMinutes() : -1
  const boardingState = useBoardingSimulation(trainsSets, cities, trains, gameTimeMin, defaultPricing)

  // Live budget = saved balance (from Firebase) + revenue accrued so far today (local boarding sim)
  // No Firebase writes during the day — backend reconciles fully at EOD via save_daily_report
  const todayRevenue = useMemo(() => {
    let total = 0
    for (const tsState of Object.values(boardingState)) {
      for (const kt of Object.values(tsState.transferredToday || {})) {
        total += kt.revenue ?? 0
      }
    }
    return Math.round(total)
  }, [boardingState])

  const budget = savedBalance + todayRevenue

  const trainActions = useTrainActions({ baseTrains, budget, gameDate })
  const financeActions = useFinanceActions({ budget, playerDoc, gameConstants, gameDate })
  const scheduleActions = useScheduleActions({ cities, trainsSets, setSelectedRoute: selection.setSelectedRoute })
  const hrActions = useHRActions({ budget, trainsSets, employees, gameConstants, gameDate, boardingState })

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
      await setDoc(doc(db, 'players', auth.currentUser.uid), { defaultPricing: config }, { merge: true })
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

  // Hook rules preserved: renders early returns AFTER all hooks!
  if (loading) {
    return (
      <div style={{ background: '#0a0a0c', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff8c00', fontSize: '20px', fontWeight: 'bold' }}>
        Ładowanie profilu dyrektora...
      </div>
    );
  }

  if (!playerDoc?.companyName) {
    return <Onboarding />;
  }

  return (
    <GameContext.Provider value={{
      // Dane
      budget, trains, trainsSets, routes, cities, loading, gameTime, gameDate,
      baseTrains, gameSettings, pictures, playerDoc,
      deposits, depositRates, gameConstants,
      employees, financeLedger, hallOfFame,
      listedCompanies, myPortfolio,
      lastDailyReport,
      // Pochodne
      activeTrainsCount, defaultPricing, trainSetsByCity,
      companyName, reputation,
      // Symulacja boardingu (frontend)
      boardingState,
      // Selekcja
      selectedCity, selectedRoute, selectedTrainSet,
      selectCity, selectRoute, selectTrainSet,
      // Akcje pociągów
      ...trainActions,
      // Akcje finansowe
      ...financeActions,
      // Akcje rozkładów
      ...scheduleActions,
      // Akcje kadr
      ...hrActions,
      // Helpery
      getTrainById, getCityById, getDemandForRoute,
      getTicketPrice, updateDefaultPricing, getDeparturesForCity,
      // Słońce
      sunTimes,
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
