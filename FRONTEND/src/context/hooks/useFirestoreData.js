import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, query, orderBy, limit } from 'firebase/firestore'
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

    const unsubCities = onSnapshot(collection(db, 'cities'), (snap) => {
      setCities(snap.docs.map(d => d.data()))
      markLoaded()
    })
    const unsubBaseTrains = onSnapshot(collection(db, 'trains'), (snap) => {
      setBaseTrains(snap.docs.map(d => d.data()))
      markLoaded()
    })
    const unsubPlayerTrains = onSnapshot(collection(db, `players/${auth.currentUser.uid}/trains`), (snap) => {
      setPlayerTrains(snap.docs.map(d => d.data()))
      markLoaded()
    })
    const unsubTrainsSets = onSnapshot(collection(db, `players/${auth.currentUser.uid}/trainSet`), (snap) => {
      setTrainsSets(snap.docs.map(d => d.data()))
      markLoaded()
    })
    const unsubRoutes = onSnapshot(collection(db, 'routes'), (snap) => {
      setRoutes(snap.docs.map(d => d.data()))
      markLoaded()
    })
    const unsubPlayer = onSnapshot(doc(db, 'players', auth.currentUser.uid), (snap) => {
      setPlayerDoc(snap.exists() ? snap.data() : {})
      markLoaded()
    })
    const unsubSettings = onSnapshot(doc(db, 'gameSettings', 'config'), (snap) => {
      setGameSettings(snap.exists() ? snap.data() : {})
      markLoaded()
    })
    const unsubPictures = onSnapshot(doc(db, 'gameConfig', 'pictures'), (snap) => {
      setPictures(snap.exists() ? snap.data() : {})
      markLoaded()
    })
    const unsubSun = onSnapshot(doc(db, 'gameConfig', 'sunTimes'), (snap) => {
      setSunTimes(snap.exists() ? snap.data() : {})
    })
    const unsubFame = onSnapshot(doc(db, 'globalStats', 'hallOfFame'), (snap) => {
      setHallOfFame(snap.exists() ? snap.data() : {})
    }, (err) => console.error('[HallOfFame] Firestore error:', err))
    const unsubConstants = onSnapshot(doc(db, 'gameConfig', 'constants'), (snap) => {
      setGameConstants(snap.exists() ? snap.data() : {})
    })

    // Lokaty i oprocentowanie — nie blokują głównego loadingu
    const unsubDeposits = onSnapshot(collection(db, `players/${auth.currentUser.uid}/deposits`), (snap) => {
      setDeposits(snap.docs.map(d => d.data()))
    })
    const unsubDepositRates = onSnapshot(doc(db, 'gameConfig', 'depositRates'), (snap) => {
      setDepositRates(snap.exists() ? snap.data() : {})
    })

    // Pracownicy (kadry)
    const unsubEmployees = onSnapshot(
      collection(db, `players/${auth.currentUser.uid}/kadry`),
      (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    // Giełda — notowane spółki
    const unsubExchange = onSnapshot(collection(db, 'exchange'), (snap) => {
      setListedCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    // Portfel giełdowy gracza
    const unsubPortfolio = onSnapshot(doc(db, 'portfolios', auth.currentUser.uid), (snap) => {
      setMyPortfolio(snap.exists() ? snap.data() : null)
    })

    // Księga finansowa – ostatnie 30 wpisów
    const ledgerQuery = query(
      collection(db, `players/${auth.currentUser.uid}/financeLedger`),
      orderBy('date', 'desc'),
      limit(30)
    )
    const unsubLedger = onSnapshot(ledgerQuery, (snap) => {
      setFinanceLedger(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return () => {
      unsubCities()
      unsubBaseTrains()
      unsubPlayerTrains()
      unsubTrainsSets()
      unsubRoutes()
      unsubPlayer()
      unsubSettings()
      unsubPictures()
      unsubDeposits()
      unsubDepositRates()
      unsubEmployees()
      unsubLedger()
      unsubSun()
      unsubFame()
      unsubConstants()
      unsubExchange()
      unsubPortfolio()
    }
  }, [])

  return { baseTrains, playerTrains, trainsSets, routes, cities, playerDoc, gameSettings, pictures, deposits, depositRates, employees, financeLedger, sunTimes, hallOfFame, gameConstants, listedCompanies, myPortfolio, loading }
}
;