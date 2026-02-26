import { db } from './config'
import { doc, setDoc } from 'firebase/firestore'
import { CITIES } from '../data/cities'
import { TRAINS, INITIAL_ROUTES } from '../data/gameData'

export async function migrateToFirestore() {
  try {
    // 1. Zapisujemy miasta
    let countCities = 0;
    for (const city of CITIES) {
      await setDoc(doc(db, 'cities', city.id), city)
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
