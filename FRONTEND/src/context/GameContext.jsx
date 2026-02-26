import { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { collection, onSnapshot, getDocs, doc, updateDoc, setDoc, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config'
import { INITIAL_BUDGET } from '../data/gameData'

const GameContext = createContext(null)

// Domyślny cennik globalny — używany zanim gracz zapisze własny
export const DEFAULT_PRICE_CONFIG = {
  class1Per100km: 10,
  class2Per100km: 6,
  multipliers: [1.0, 0.9, 0.8, 0.7, 0.65, 0.6],
}

export function GameProvider({ children }) {
  const [budget] = useState(INITIAL_BUDGET)
  const [baseTrains, setBaseTrains] = useState([])
  const [playerTrains, setPlayerTrains] = useState([])
  const [trainsSets, setTrainsSets] = useState([])
  const [routes, setRoutes] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [demandMap, setDemandMap] = useState(new Map())
  const [playerDoc, setPlayerDoc] = useState({})

  useEffect(() => {
    const unsubCities = onSnapshot(collection(db, 'cities'), (snapshot) => {
      setCities(snapshot.docs.map(doc => doc.data()))
    })

    const unsubBaseTrains = onSnapshot(collection(db, 'trains'), (snapshot) => {
      setBaseTrains(snapshot.docs.map(doc => doc.data()))
    })

    const unsubPlayerTrains = onSnapshot(collection(db, 'players/player1/trains'), (snapshot) => {
      setPlayerTrains(snapshot.docs.map(doc => doc.data()))
    })

    const unsubTrainsSets = onSnapshot(collection(db, 'players/player1/trainSet'), (snapshot) => {
      setTrainsSets(snapshot.docs.map(doc => doc.data()))
    })

    const unsubRoutes = onSnapshot(collection(db, 'routes'), (snapshot) => {
      setRoutes(snapshot.docs.map(doc => doc.data()))
    })

    // Karta gracza — zawiera m.in. globalny cennik domyślny
    const unsubPlayer = onSnapshot(doc(db, 'players', 'player1'), (snap) => {
      setPlayerDoc(snap.exists() ? snap.data() : {})
    })

    getDocs(collection(db, 'demand')).then(snapshot => {
      const map = new Map()
      snapshot.docs.forEach(d => {
        const { from, to, demand } = d.data()
        map.set(`${from}--${to}`, demand)
        map.set(`${to}--${from}`, demand)
      })
      setDemandMap(map)
    })

    setTimeout(() => setLoading(false), 1000)

    return () => {
      unsubCities()
      unsubBaseTrains()
      unsubPlayerTrains()
      unsubTrainsSets()
      unsubRoutes()
      unsubPlayer()
    }
  }, [])

  // Globalny cennik gracza — fallback na domyślne wartości jeśli gracz jeszcze nie zapisał
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
    () => new Set(routes.filter((r) => r.trainId).map((r) => r.trainId)).size,
    [routes]
  )

  function selectCity(city) {
    if (selectedCity?.id === city.id) {
      setSelectedCity(null)
    } else {
      setSelectedCity(city)
      setSelectedRoute(null)
    }
  }

  function selectRoute(route) {
    if (selectedRoute?.id === route.id) {
      setSelectedRoute(null)
    } else {
      setSelectedRoute(route)
      setSelectedCity(null)
    }
  }

  async function updateRouteSchedule(routeId, departures) {
    try {
      await updateDoc(doc(db, 'routes', routeId), { departures })
      setSelectedRoute((prev) =>
        prev?.id === routeId ? { ...prev, departures } : prev
      )
    } catch (e) {
      console.error("Błąd aktualizacji harmonogramu: ", e)
    }
  }

  function getTrainById(id) {
    return trains.find((t) => t.id === id) || null
  }

  function getCityById(id) {
    return cities.find((c) => c.id === id) || null
  }

  function getDemandForRoute(route) {
    return demandMap.get(`${route.from}--${route.to}`) ?? 0
  }

  // Zwraca efektywny cennik składu: własny jeśli ustawiony, globalny jeśli nie
  function getTicketPrice(trainSetId) {
    const ts = trainsSets.find(t => t.id === trainSetId)
    return ts?.pricing ?? defaultPricing
  }

  // Zapisuje własny cennik składu; null — usuwa własny i przywraca globalny
  async function updateTicketPrice(trainSetId, config) {
    try {
      await updateDoc(
        doc(db, 'players/player1/trainSet', trainSetId),
        { pricing: config === null ? deleteField() : config }
      )
    } catch (e) {
      console.error('Błąd aktualizacji cen biletów składu:', e)
    }
  }

  // Zapisuje globalny cennik gracza (w dokumencie players/player1)
  async function updateDefaultPricing(config) {
    try {
      await setDoc(doc(db, 'players', 'player1'), { defaultPricing: config }, { merge: true })
    } catch (e) {
      console.error('Błąd aktualizacji globalnego cennika:', e)
    }
  }

  function getDeparturesForCity(cityId) {
    const cityRoutes = routes.filter(
      (r) => (r.from === cityId || r.to === cityId) && r.departures.length > 0
    )

    const result = []
    cityRoutes.forEach((route) => {
      const train = getTrainById(route.trainId)
      const otherCityId = route.from === cityId ? route.to : route.from
      const otherCity = getCityById(otherCityId)
      route.departures.forEach((dep, i) => {
        result.push({
          id: `${route.id}-${dep}`,
          destination: otherCity?.name || otherCityId,
          departure: dep,
          platform: (result.length % 6) + 1,
          trainId: train?.name || '—',
          trainType: train?.type || '',
          status: i === 0 ? 'BOARDING' : 'ON TIME',
          routeId: route.id,
        })
      })
    })

    return result.sort((a, b) => a.departure.localeCompare(b.departure))
  }

  return (
    <GameContext.Provider
      value={{
        budget,
        trains,
        trainsSets,
        routes,
        cities,
        loading,
        selectedCity,
        selectedRoute,
        dailyRevenue,
        activeTrainsCount,
        defaultPricing,
        selectCity,
        selectRoute,
        updateRouteSchedule,
        getTrainById,
        getCityById,
        getDeparturesForCity,
        getDemandForRoute,
        getTicketPrice,
        updateTicketPrice,
        updateDefaultPricing,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
