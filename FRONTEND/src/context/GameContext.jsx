import { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteField, writeBatch } from 'firebase/firestore'
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
  const [baseTrains, setBaseTrains] = useState([])
  const [playerTrains, setPlayerTrains] = useState([])
  const [trainsSets, setTrainsSets] = useState([])
  const [routes, setRoutes] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [selectedTrainSet, setSelectedTrainSet] = useState(null)
  const [playerDoc, setPlayerDoc] = useState({})
  const [gameSettings, setGameSettings] = useState({})

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

    const unsubSettings = onSnapshot(doc(db, 'gameSettings', 'config'), (snap) => {
      setGameSettings(snap.exists() ? snap.data() : {})
    })

    setTimeout(() => setLoading(false), 1000)

    return () => {
      unsubCities()
      unsubBaseTrains()
      unsubPlayerTrains()
      unsubTrainsSets()
      unsubRoutes()
      unsubPlayer()
      unsubSettings()
    }
  }, [])

  // Globalny cennik gracza — fallback na domyślne wartości jeśli gracz jeszcze nie zapisał
  const defaultPricing = useMemo(
    () => playerDoc.defaultPricing ?? DEFAULT_PRICE_CONFIG,
    [playerDoc]
  )

  const companyName = playerDoc.companyName ?? ''
  const reputation = playerDoc.reputation ?? 0.5
  const budget = playerDoc.finance?.balance ?? INITIAL_BUDGET

  async function buyTrain(baseTrainId) {
    const baseTrain = baseTrains.find((t) => t.id === baseTrainId)
    if (!baseTrain) return false

    // Fallback price if DB doesn't have it defined
    const vehiclePrice = baseTrain.price || ((baseTrain.speed || 100) * (baseTrain.seats || 50) * 100)

    if (budget < vehiclePrice) {
      alert('Niewystarczające środki na koncie!')
      return false
    }

    try {
      const batch = writeBatch(db)

      const generateId = () => `pt_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`
      const newTrainId = generateId()
      const playerTrainRef = doc(db, `players/player1/trains/${newTrainId}`)

      const purchasedAt = new Date().toISOString()
      batch.set(playerTrainRef, {
        id: newTrainId,
        parent_id: baseTrain.id,
        name: `${baseTrain.name} #${Math.floor(Math.random() * 900) + 100}`,
        purchasedAt,
        lastMaintenance: purchasedAt,
        lastOverhaul: purchasedAt
      })

      batch.set(
        doc(db, 'players', 'player1'),
        { finance: { balance: budget - vehiclePrice } },
        { merge: true }
      )

      await batch.commit()
      alert(`Zakupiono pociąg! Kwota ${vehiclePrice.toLocaleString()} PLN pomyślnie pobrana z konta.`)
      return true
    } catch (e) {
      console.error('Błąd podczas zakupu pociągu:', e)
      return false
    }
  }

  async function performMaintenance(trainId) {
    try {
      const now = new Date().toISOString()
      await updateDoc(doc(db, `players/player1/trains/${trainId}`), {
        lastMaintenance: now
      })
      return true
    } catch (e) {
      console.error('Błąd podczas ręcznej konserwacji:', e)
      return false
    }
  }

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
      setSelectedTrainSet(null)
    }
  }

  function selectTrainSet(trainSet) {
    if (selectedTrainSet?.id === trainSet?.id) {
      setSelectedTrainSet(null)
    } else {
      setSelectedTrainSet(trainSet)
      setSelectedCity(null)
      setSelectedRoute(null)
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

  // Popyt dla trasy — czyta pole `demand` z dokumentu miasta źródłowego
  function getDemandForRoute(route) {
    const fromCity = cities.find(c => c.id === route.from)
    return fromCity?.demand?.[route.to] ?? 0
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

  // Czyta rozkład bezpośrednio z pola city.rozklad (źródło prawdy w bazie)
  function getDeparturesForCity(cityId) {
    const city = getCityById(cityId)
    if (!city?.rozklad?.length) return []
    return [...city.rozklad]
      .filter(entry => {
        // nie pokazuj odjazdu do tego samego miasta
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

  // Aktualizuje city.rozklad dla jednego składu (usuwa stare, wpisuje nowe)
  async function updateCitySchedules(trainSetId, newRozklad, trainSetMeta = {}) {
    try {
      const batch = writeBatch(db)
      const resolveCityId = (miasto) =>
        cities.find(c => c.id === miasto || c.name === miasto)?.id

      const newCityEntries = {}
      if (newRozklad?.length) {
        const byKurs = {}
        newRozklad.forEach(stop => {
          if (!byKurs[stop.kurs]) byKurs[stop.kurs] = []
          byKurs[stop.kurs].push(stop)
        })
        Object.values(byKurs).forEach(stops => {
          stops.forEach((stop, idx) => {
            if (!stop.odjazd) return
            const cityId = resolveCityId(stop.miasto)
            if (!cityId) return
            const via = stops.slice(idx + 1, stops.length - 1).map(s => s.miasto)
            const terminal = stops[stops.length - 1]
            const destination = stop.kierunek || terminal?.miasto || '—'
            if (resolveCityId(destination) === cityId) return // odjazd do siebie samego
            if (!newCityEntries[cityId]) newCityEntries[cityId] = []
            newCityEntries[cityId].push({
              trainSetId,
              trainName: trainSetMeta.name || '—',
              trainType: trainSetMeta.type || '',
              trainNo: trainSetMeta.trainNo || null,
              departure: stop.odjazd,
              destination,
              kurs: stop.kurs,
              via,
            })
          })
        })
      }

      const affectedIds = new Set([
        ...cities.filter(c => c.rozklad?.some(e => e.trainSetId === trainSetId)).map(c => c.id),
        ...Object.keys(newCityEntries),
      ])
      affectedIds.forEach(cityId => {
        const city = cities.find(c => c.id === cityId)
        if (!city) return
        const kept = (city.rozklad || []).filter(e => e.trainSetId !== trainSetId)
        batch.update(doc(db, 'cities', cityId), { rozklad: [...kept, ...(newCityEntries[cityId] || [])] })
      })

      await batch.commit()
    } catch (e) {
      console.error('Błąd aktualizacji rozkładu miast:', e)
    }
  }

  // Zapisuje układ przystanków na obiekcie składu pociągu
  async function saveTrainRoute(trainSetId, routeStops, newRozklad) {
    try {
      await updateDoc(doc(db, 'players/player1/trainSet', trainSetId), {
        routeStops,
        rozklad: newRozklad
      })
    } catch (e) {
      console.error('Błąd zapisu przypisanej trasy na składzie', e)
    }
  }

  // Przebudowuje city.rozklad dla wszystkich składów na podstawie trainSet.rozklad
  async function rebuildAllCitySchedules() {
    try {
      const batch = writeBatch(db)
      const resolveCityId = (miasto) =>
        cities.find(c => c.id === miasto || c.name === miasto)?.id

      const newCityEntries = {}
      trainsSets.forEach(ts => {
        if (!ts.rozklad?.length) return
        const byKurs = {}
        ts.rozklad.forEach(stop => {
          if (!byKurs[stop.kurs]) byKurs[stop.kurs] = []
          byKurs[stop.kurs].push(stop)
        })
        Object.values(byKurs).forEach(stops => {
          stops.forEach((stop, idx) => {
            if (!stop.odjazd) return
            const cityId = resolveCityId(stop.miasto)
            if (!cityId) return
            const via = stops.slice(idx + 1, stops.length - 1).map(s => s.miasto)
            const terminal = stops[stops.length - 1]
            const destination = stop.kierunek || terminal?.miasto || '—'
            if (resolveCityId(destination) === cityId) return // odjazd do siebie samego
            if (!newCityEntries[cityId]) newCityEntries[cityId] = []
            newCityEntries[cityId].push({
              trainSetId: ts.id,
              trainName: ts.name || '—',
              trainType: ts.type || '',
              trainNo: ts.trainNo || null,
              departure: stop.odjazd,
              destination,
              kurs: stop.kurs,
              via,
            })
          })
        })
      })

      cities.forEach(city => {
        batch.update(doc(db, 'cities', city.id), { rozklad: newCityEntries[city.id] || [] })
      })
      await batch.commit()
      console.log('Rozkłady miast przebudowane.')
    } catch (e) {
      console.error('Błąd przebudowy rozkładów miast:', e)
    }
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
        selectedTrainSet,
        dailyRevenue,
        activeTrainsCount,
        defaultPricing,
        selectCity,
        selectRoute,
        selectTrainSet,
        updateRouteSchedule,
        getTrainById,
        getCityById,
        getDeparturesForCity,
        getDemandForRoute,
        getTicketPrice,
        updateTicketPrice,
        updateDefaultPricing,
        companyName,
        reputation,
        updateCitySchedules,
        rebuildAllCitySchedules,
         saveTrainRoute,
        buyTrain,
        performMaintenance,
        baseTrains,
        gameSettings,
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
