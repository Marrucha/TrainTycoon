import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../context/GameContext'
import styles from './DepartureBoard.module.css'

function FlipCell({ value }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        className={styles.flipCell}
        initial={{ rotateX: -90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        exit={{ rotateX: 90, opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  )
}

export default function DepartureBoard() {
  const { selectedCity, getDeparturesForCity, selectCity } = useGame()
  const departures = selectedCity ? getDeparturesForCity(selectedCity.id) : []

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => selectCity(selectedCity)}>
            ← wróć
          </button>
          <span className={styles.stationName}>
            {selectedCity?.name.toUpperCase() ?? ''}
          </span>
          <span className={styles.title}>ODJAZDY</span>
        </div>
        <Clock />
      </div>

      <div className={styles.colHeaders}>
        <span>GODZ.</span>
        <span>KIERUNEK</span>
        <span>PERON</span>
        <span>POCIĄG</span>
        <span>STATUS</span>
      </div>

      {departures.length > 0 ? (
        <AnimatePresence>
          {departures.map((dep) => (
            <motion.div
              key={dep.id}
              className={`${styles.row} ${dep.status === 'BOARDING' ? styles.boardingRow : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <span className={styles.time}>
                <FlipCell value={dep.departure} />
              </span>
              <span className={styles.destination}>{dep.destination}</span>
              <span className={styles.platform}>{dep.platform}</span>
              <span className={styles.trainId}>{dep.trainId}</span>
              <span className={`${styles.status} ${dep.status === 'BOARDING' ? styles.boarding : styles.onTime}`}>
                {dep.status}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      ) : (
        <div className={styles.empty}>
          Brak kursów z tej stacji
        </div>
      )}
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <span className={styles.clock}>
      {time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}
