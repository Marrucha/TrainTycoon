import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, query, orderBy, limit, getDocs, getDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'

export function useFirestoreData() {
  const [baseTrains, setBaseTrains] = useState([])
  const [playerTrains, setPlayerTrains] = useState([])
  const [trainsSets, setTrainsSets] = useState([])
  const [routes, setRoutes] = useState([])
  const [cities, setCities] = useState([])
  const [playerDoc, setPlayerDoc] = useState({})
  const [gameSettings, setGameSettings] = useState({})
  const [pictures, setPictures] = useState({})
  const [deposits, setDeposits] = useState([])
  const [depositRates, setDepositRates] = useState({})
  const [employees, setEmployees] = useState([])
  const [financeLedger, setFinanceLedger] = useState([])
  const [sunTimes, setSunTimes] = useState(null)
  const [hallOfFame, setHallOfFame] = useState({})
  const [gameConstants, setGameConstants] = useState(null)
  const [listedCompanies, setListedCompanies] = useState([])
  const [myPortfolio, setMyPortfolio] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let loadedCount = 0
    const TOTAL = 8

    const markLoaded = () => {
      loadedCount++
      if (loadedCount >= TOTAL) setLoading(false)
    }

    // -----------------------------------------------------------------------
    // DANE STATYCZNE — pobrane jednorazowo (getDocs/getDoc), bez nasłuchu.
    // Zmieniane tylko przez admina; gracz nie potrzebuje live updates.
    // Oszczędność: eliminuje ~10 otwartych WebSocket listenerów.
    // -----------------------------------------------------------------------

    // cities, trains (bazowe), routes — nigdy nie zmieniają się w trakcie gry
    Promise.all([
      getDocs(collection(db, 'cities')),
      getDocs(collection(db, 'trains')),
      getDocs(collection(db, 'routes')),
    ]).then(([citiesSnap, trainsSnap, routesSnap]) => {
      setCities(citiesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBaseTrains(trainsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setRoutes(routesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      markLoaded() // cities
      markLoaded() // trains
      markLoaded() // routes
    }).catch(err => {
      console.error('[StaticData] Bład pobierania danych statycznych:', err)
      markLoaded(); markLoaded(); markLoaded()
    })

    // gameSettings, pictures, sunTimes, depositRates, hallOfFame — rzadko zmieniane
    Promise.all([
      getDoc(doc(db, 'gameSettings', 'config')),
      getDoc(doc(db, 'gameConfig', 'pictures')),
      getDoc(doc(db, 'gameConfig', 'sunTimes')),
      getDoc(doc(db, 'gameConfig', 'depositRates')),
      getDoc(doc(db, 'globalStats', 'hallOfFame')),
    ]).then(([settingsSnap, picturesSnap, sunSnap, ratesSnap, fameSnap]) => {
      setGameSettings(settingsSnap.exists() ? settingsSnap.data() : {})
      setPictures(picturesSnap.exists() ? picturesSnap.data() : {})
      setSunTimes(sunSnap.exists() ? sunSnap.data() : {})
      setDepositRates(ratesSnap.exists() ? ratesSnap.data() : {})
      setHallOfFame(fameSnap.exists() ? fameSnap.data() : {})
      markLoaded() // gameSettings
      markLoaded() // pictures
    }).catch(err => {
      console.error('[StaticData] Bład pobierania konfiguracji:', err)
      markLoaded(); markLoaded()
    })

    // Gielda — aktualizowana raz dziennie przez backend EOD
    getDocs(collection(db, 'exchange')).then(snap => {
      setListedCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }).catch(err => console.error('[Exchange] Bład pobierania gieldy:', err))

    // -----------------------------------------------------------------------
    // DANE DYNAMICZNE — onSnapshot, bo zmieniają się w trakcie sesji gracza.
    // -----------------------------------------------------------------------

    // gameConfig/constants — moze byc naprawiane automatycznie przez GameContext
    const unsubConstants = onSnapshot(doc(db, 'gameConfig', 'constants'), (snap) => {
      setGameConstants(snap.exists() ? snap.data() : {})
    })

    // Dane gracza — balance, reputation, defaultPricing itp.
    const unsubPlayer = onSnapshot(doc(db, 'players', auth.currentUser.uid), (snap) => {
      setPlayerDoc(snap.exists() ? snap.data() : {})
      markLoaded()
    })

    // Wagony gracza — przy zakupie nowego taboru
    const unsubPlayerTrains = onSnapshot(collection(db, `players/${auth.currentUser.uid}/trains`), (snap) => {
      setPlayerTrains(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      markLoaded()
    })

    // Sklady — aktualizowane przez boarding_tick i przez gracza
    const unsubTrainsSets = onSnapshot(collection(db, `players/${auth.currentUser.uid}/trainSet`), (snap) => {
      setTrainsSets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      markLoaded()
    })

    // Lokaty — przy zakladaniu/zamykaniu lokaty
    const unsubDeposits = onSnapshot(collection(db, `players/${auth.currentUser.uid}/deposits`), (snap) => {
      setDeposits(snap.docs.map(d => d.data()))
    })

    // Pracownicy (kadry) — przy zmianach kadrowych
    const unsubEmployees = onSnapshot(
      collection(db, `players/${auth.currentUser.uid}/kadry`),
      (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    // Portfel gieldowy — przy transakcjach gieldowych
    const unsubPortfolio = onSnapshot(doc(db, 'portfolios', auth.currentUser.uid), (snap) => {
      setMyPortfolio(snap.exists() ? snap.data() : null)
    })

    // Ksiega finansowa — ostatnie 30 wpisow (zmienia sie raz dziennie przy EOD)
    const ledgerQuery = query(
      collection(db, `players/${auth.currentUser.uid}/financeLedger`),
      orderBy('date', 'desc'),
      limit(30)
    )
    const unsubLedger = onSnapshot(ledgerQuery, (snap) => {
      setFinanceLedger(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return () => {
      unsubConstants()
      unsubPlayer()
      unsubPlayerTrains()
      unsubTrainsSets()
      unsubDeposits()
      unsubEmployees()
      unsubPortfolio()
      unsubLedger()
    }
  }, [])

  return { baseTrains, playerTrains, trainsSets, routes, cities, playerDoc, gameSettings, pictures, deposits, depositRates, employees, financeLedger, sunTimes, hallOfFame, gameConstants, listedCompanies, myPortfolio, loading }
}
