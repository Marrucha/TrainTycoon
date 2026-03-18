import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'

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
    const unsubPlayerTrains = onSnapshot(collection(db, 'players/player1/trains'), (snap) => {
      setPlayerTrains(snap.docs.map(d => d.data()))
      markLoaded()
    })
    const unsubTrainsSets = onSnapshot(collection(db, 'players/player1/trainSet'), (snap) => {
      setTrainsSets(snap.docs.map(d => d.data()))
      markLoaded()
    })
    const unsubRoutes = onSnapshot(collection(db, 'routes'), (snap) => {
      setRoutes(snap.docs.map(d => d.data()))
      markLoaded()
    })
    const unsubPlayer = onSnapshot(doc(db, 'players', 'player1'), (snap) => {
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

    // Lokaty i oprocentowanie — nie blokują głównego loadingu
    const unsubDeposits = onSnapshot(collection(db, 'players/player1/deposits'), (snap) => {
      setDeposits(snap.docs.map(d => d.data()))
    })
    const unsubDepositRates = onSnapshot(doc(db, 'gameConfig', 'depositRates'), (snap) => {
      setDepositRates(snap.exists() ? snap.data() : {})
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
    }
  }, [])

  return { baseTrains, playerTrains, trainsSets, routes, cities, playerDoc, gameSettings, pictures, deposits, depositRates, loading }
}
