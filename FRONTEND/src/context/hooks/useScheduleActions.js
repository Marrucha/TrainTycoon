import { doc, updateDoc, writeBatch, deleteField } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'

// Wspólna logika budowania wpisów rozkładu dla miast
function buildCityEntries(rozklad, trainSetMeta, resolveCityId) {
  const entries = {}
  if (!rozklad?.length) return entries

  const byKurs = {}
  rozklad.forEach(stop => {
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
      if (resolveCityId(destination) === cityId) return
      if (!entries[cityId]) entries[cityId] = []
      entries[cityId].push({
        trainSetId: trainSetMeta.id,
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

  return entries
}

export function useScheduleActions({ cities, trainsSets, setSelectedRoute }) {
  const resolveCityId = (miasto) =>
    cities.find(c => c.id === miasto || c.name === miasto)?.id

  async function updateRouteSchedule(routeId, departures) {
    try {
      await updateDoc(doc(db, 'routes', routeId), { departures })
      setSelectedRoute(prev => prev?.id === routeId ? { ...prev, departures } : prev)
    } catch (e) {
      console.error('Błąd aktualizacji harmonogramu:', e)
    }
  }

  async function updateCitySchedules(trainSetId, newRozklad, trainSetMeta = {}) {
    try {
      const batch = writeBatch(db)
      const newCityEntries = buildCityEntries(newRozklad, { id: trainSetId, ...trainSetMeta }, resolveCityId)

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

  async function rebuildAllCitySchedules() {
    try {
      const batch = writeBatch(db)
      const newCityEntries = {}

      trainsSets.forEach(ts => {
        const entries = buildCityEntries(ts.rozklad, ts, resolveCityId)
        Object.entries(entries).forEach(([cityId, cityEntries]) => {
          if (!newCityEntries[cityId]) newCityEntries[cityId] = []
          newCityEntries[cityId].push(...cityEntries)
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

  async function saveTrainRoute(trainSetId, routeStops, newRozklad, assignedRoutes = []) {
    try {
      await updateDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, trainSetId), {
        routeStops,
        rozklad: newRozklad,
        assignedRoutes,
      })
    } catch (e) {
      console.error('Błąd zapisu przypisanej trasy na składzie:', e)
    }
  }

  async function updateTicketPrice(trainSetId, config) {
    try {
      await updateDoc(
        doc(db, `players/${auth.currentUser.uid}/trainSet`, trainSetId),
        { pricing: config === null ? deleteField() : config }
      )
    } catch (e) {
      console.error('Błąd aktualizacji cen biletów składu:', e)
    }
  }

  return { updateRouteSchedule, updateCitySchedules, rebuildAllCitySchedules, saveTrainRoute, updateTicketPrice }
}
;