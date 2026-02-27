import { db } from './config'
import { doc, setDoc, writeBatch } from 'firebase/firestore'
import { CITIES } from '../data/cities'
import { TRAINS, INITIAL_ROUTES } from '../data/gameData'
import { getDemand, hinterland } from '../data/demand'

// Trzy profile godzinowe — wagi dla godzin 0–23, suma ≈ 100 (procent dobowego popytu)
const HOUR_DEMAND_PROFILES = [
  {
    id: 'maly-duzy',
    label: 'Małe → Duże',
    // Szczyt poranny (dojazd do większego miasta) — dominujący ok. godziny 8
    weights: [0.4, 0.4, 0.3, 0.4, 1, 3, 5.4, 8.1, 8.8, 8.1, 7, 6.5, 6, 5.5, 5.1, 5.2, 5.9, 6, 5.3, 4, 3.3, 2.1, 1.4, 0.8],
  },
  {
    id: 'podobne',
    label: 'Podobne',
    // Dwa zbliżone szczyty: poranny i popołudniowy
    weights: [0.5, 0.4, 0.3, 0.4, 1, 2.3, 4.6, 6.7, 7.1, 6.7, 6.1, 5.9, 5.9, 6.2, 6.2, 6.4, 7, 6.7, 5.8, 4.6, 3.7, 2.6, 1.8, 1.1],
  },
  {
    id: 'duzy-maly',
    label: 'Duże → Małe',
    // Szczyt popołudniowy (powrót z większego miasta) — dominujący ok. godziny 16–17
    weights: [0.5, 0.4, 0.3, 0.4, 1, 2, 4, 5, 5.2, 4.9, 4.9, 5.2, 5.7, 6.8, 7.4, 7.7, 7.8, 7.5, 6.7, 5.4, 4.3, 3.3, 2.1, 1.3],
  },
]

export async function migrateToFirestore() {
  try {
    // 1. Zapisujemy miasta (z wyliczonym otoczeniem komunikacyjnym)
    let countCities = 0;
    for (const city of CITIES) {
      const pop = city.population ?? 0
      const cityDoc = pop > 0
        ? { ...city, hinterland: hinterland(pop), effectivePop: pop + hinterland(pop) }
        : city
      await setDoc(doc(db, 'cities', city.id), cityDoc)
      countCities++;
    }
    console.log(`Pomyślnie zmigrowano ${countCities} miast.`)

    // 2. Zapisujemy pociągi
    let countTrains = 0;
    for (const train of TRAINS) {
      await setDoc(doc(db, 'trains', train.id), train)
      countTrains++;
    }
    console.log(`Pomyślnie zmigrowano ${countTrains} pociągów.`)

    // 3. Zapisujemy trasy
    let countRoutes = 0;
    for (const route of INITIAL_ROUTES) {
      await setDoc(doc(db, 'routes', route.id), route)
      countRoutes++;
    }
    console.log(`Pomyślnie zmigrowano ${countRoutes} tras.`)

    alert('Migracja danych do Firestore zakończyła się sukcesem!')
  } catch (error) {
    console.error('Błąd podczas migracji:', error)
    alert('Błąd podczas migracji: ' + error.message)
  }
}

/**
 * Oblicza popyt dla wszystkich par miast i zapisuje wyniki do kolekcji `demand`.
 * Dokument ID: "cityAId--cityBId" (tylko jedna kolejność — A < B).
 * Używa batch write (max 500 op/batch) zamiast sekwencyjnych setDoc.
 * Pomija pary z popytem 0 (węzły graniczne bez populacji).
 */
export async function migrateDemand() {
  const BATCH_LIMIT = 500
  try {
    let batch = writeBatch(db)
    let batchCount = 0
    let totalCount = 0

    for (let i = 0; i < CITIES.length; i++) {
      for (let j = i + 1; j < CITIES.length; j++) {
        const a = CITIES[i]
        const b = CITIES[j]
        const demand = getDemand(a, b)
        if (demand === 0) continue

        batch.set(doc(db, 'demand', `${a.id}--${b.id}`), { from: a.id, to: b.id, demand })
        batchCount++
        totalCount++

        if (batchCount === BATCH_LIMIT) {
          await batch.commit()
          batch = writeBatch(db)
          batchCount = 0
        }
      }
    }

    if (batchCount > 0) await batch.commit()

    console.log(`Pomyślnie zmigrowano ${totalCount} par miast (popyt).`)
    alert(`Migracja popytu zakończona: ${totalCount} par miast.`)
  } catch (error) {
    console.error('Błąd podczas migracji popytu:', error)
    alert('Błąd podczas migracji popytu: ' + error.message)
  }
}

/**
 * Przenosi popyt z kolekcji `demand` do pola `demand` w każdym dokumencie miasta.
 * Struktura: cities/{cityId}.demand = { [otherCityId]: liczba, ... }
 * Zapis obustronny — każde miasto ma pełną mapę do wszystkich innych miast.
 * Stara kolekcja `demand` pozostaje niezmieniona (można usunąć ręcznie po migracji).
 */
export async function migrateDemandToCities() {
  try {
    // Budujemy pełne mapy popytu dla każdego miasta (obustronnie)
    const demandMaps = {}
    for (const city of CITIES) {
      demandMaps[city.id] = {}
    }

    for (let i = 0; i < CITIES.length; i++) {
      for (let j = i + 1; j < CITIES.length; j++) {
        const a = CITIES[i]
        const b = CITIES[j]
        const demand = getDemand(a, b)
        if (demand === 0) continue
        demandMaps[a.id][b.id] = demand
        demandMaps[b.id][a.id] = demand
      }
    }

    // Batch update — dodaje pole `demand` do istniejących dokumentów miast
    const BATCH_LIMIT = 500
    let batch = writeBatch(db)
    let batchCount = 0
    let total = 0

    for (const city of CITIES) {
      const map = demandMaps[city.id]
      if (Object.keys(map).length === 0) continue
      batch.set(doc(db, 'cities', city.id), { demand: map }, { merge: true })
      batchCount++
      total++
      if (batchCount === BATCH_LIMIT) {
        await batch.commit()
        batch = writeBatch(db)
        batchCount = 0
      }
    }

    if (batchCount > 0) await batch.commit()

    console.log(`Zaktualizowano ${total} miast z mapą popytu.`)
    alert(`Migracja demand do miast zakończona: ${total} miast.`)
  } catch (error) {
    console.error('Błąd migracji demand do miast:', error)
    alert('Błąd: ' + error.message)
  }
}

/**
 * Zapisuje 3 profile godzinowe do kolekcji `hourDemandMap`.
 * Profile: 'maly-duzy', 'podobne', 'duzy-maly' — 24 wagi (suma ≈ 100%).
 * Wyznaczenie profilu dla konkretnej trasy → getHourProfileId() w demand.js.
 */
export async function migrateHourDemandMap() {
  try {
    for (const profile of HOUR_DEMAND_PROFILES) {
      await setDoc(doc(db, 'hourDemandMap', profile.id), profile)
    }
    console.log(`Pomyślnie zmigrowano ${HOUR_DEMAND_PROFILES.length} profile godzinowe.`)
    alert('Migracja hourDemandMap zakończona!')
  } catch (error) {
    console.error('Błąd migracji hourDemandMap:', error)
    alert('Błąd: ' + error.message)
  }
}
