import { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { INITIAL_BUDGET } from '../data/gameData'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [budget] = useState(INITIAL_BUDGET)
  const [baseTrains, setBaseTrains] = useState([]) // "Katalog sklepu"
  const [playerTrains, setPlayerTrains] = useState([]) // Moje ID i parent_id
  const [trainsSets, setTrainsSets] = useState([]) // Zestawy/składy pociagów z DB
  const [routes, setRoutes] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)

  useEffect(() => {
    const unsubCities = onSnapshot(collection(db, 'cities'), (snapshot) => {
      setCities(snapshot.docs.map(doc => doc.data()))
    })

    // Sklep bazowy
    const unsubBaseTrains = onSnapshot(collection(db, 'trains'), (snapshot) => {
      setBaseTrains(snapshot.docs.map(doc => doc.data()))
    })

    // Inwentarz gracza
    const unsubPlayerTrains = onSnapshot(collection(db, 'players/player1/trains'), (snapshot) => {
      setPlayerTrains(snapshot.docs.map(doc => doc.data()))
    })

    const unsubTrainsSets = onSnapshot(collection(db, 'players/player1/trainSet'), (snapshot) => {
      setTrainsSets(snapshot.docs.map(doc => doc.data()))
    })

    const unsubRoutes = onSnapshot(collection(db, 'routes'), (snapshot) => {
      setRoutes(snapshot.docs.map(doc => doc.data()))
    })

    setTimeout(() => setLoading(false), 1000)

    return () => {
      unsubCities()
      unsubBaseTrains()
      unsubPlayerTrains()
      unsubTrainsSets()
      unsubRoutes()
    }
  }, [])

  // Budujemy żywą tabelę, w której maszyny gracza połykają swoje statystyki z katalogu głównego
  const trains = useMemo(() => {
    return playerTrains.map(pt => {
      const baseModel = baseTrains.find(bt => bt.id === pt.parent_id) || {}
      return { ...baseModel, id: pt.id, parent_id: pt.parent_id } // zachowujemy ID obiektu w ekwipunku nadpisując ID z katalogu
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

  // Zwraca odjazdy z danego miasta (wszystkie trasy wychodzące)
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
        selectCity,
        selectRoute,
        updateRouteSchedule,
        getTrainById,
        getCityById,
        getDeparturesForCity,
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
