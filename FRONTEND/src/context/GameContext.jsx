import { createContext, useContext, useState, useMemo } from 'react'
import { INITIAL_BUDGET, TRAINS, INITIAL_ROUTES } from '../data/gameData'
import { CITIES } from '../data/cities'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [budget] = useState(INITIAL_BUDGET)
  const [trains] = useState(TRAINS)
  const [routes, setRoutes] = useState(INITIAL_ROUTES)
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)

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

  function updateRouteSchedule(routeId, departures) {
    setRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, departures } : r))
    )
    // Aktualizuj selectedRoute jeśli to ta sama trasa
    setSelectedRoute((prev) =>
      prev?.id === routeId ? { ...prev, departures } : prev
    )
  }

  function getTrainById(id) {
    return trains.find((t) => t.id === id) || null
  }

  function getCityById(id) {
    return CITIES.find((c) => c.id === id) || null
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
        routes,
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
