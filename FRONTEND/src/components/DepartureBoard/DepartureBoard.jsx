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
  const { selectedCity, getDeparturesForCity, selectCity, cities, companyName } = useGame()
  const departures = selectedCity ? getDeparturesForCity(selectedCity.id) : []

  // Popyt posortowany malejąco — odczyt z pola demand na dokumencie miasta
  const demandEntries = selectedCity?.demand
    ? Object.entries(selectedCity.demand)
        .map(([cityId, demand]) => ({ cityId, demand, name: cities.find(c => c.id === cityId)?.name ?? cityId }))
        .sort((a, b) => b.demand - a.demand)
    : []

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
        <span>NR POCIĄGU</span>
        <span>PERON</span>
        <span>POCIĄG / PRZEWOŹNIK</span>
        <span>STATUS</span>
      </div>

      {departures.length > 0 ? (
        <AnimatePresence>
          {departures.map((dep) => (
            <motion.div
              key={dep.id}
              className={`${styles.rowWrapper} ${dep.status === 'BOARDING' ? styles.boardingRow : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className={styles.row}>
                <span className={styles.time}>
                  <FlipCell value={dep.departure} />
                </span>
                <span className={styles.destination}>{dep.destination}</span>
                <span className={styles.trainNo}>
                  {dep.trainNo != null ? `${dep.trainNo}/${dep.kurs}` : '—'}
                </span>
                <span className={styles.platform}>{dep.platform}</span>
                <div className={styles.trainCell}>
                  <span className={styles.trainId}>{dep.trainId}</span>
                  {companyName && <span className={styles.carrier}>{companyName}</span>}
                </div>
                <span className={`${styles.status} ${dep.status === 'BOARDING' ? styles.boarding : styles.onTime}`}>
                  {dep.status}
                </span>
              </div>
              {dep.via?.length > 0 && (
                <div className={styles.viaLine}>
                  przez: {dep.via.join(' · ')}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      ) : (
        <div className={styles.empty}>
          Brak kursów z tej stacji
        </div>
      )}

      {demandEntries.length > 0 && (
        <div className={styles.demandSection}>
          <div className={styles.demandTitle}>POPYT PASAŻERSKI / DZIEŃ</div>
          <div className={styles.demandGrid}>
            {demandEntries.map(({ cityId, name, demand }) => (
              <div key={cityId} className={styles.demandRow}>
                <span className={styles.demandCity}>{name}</span>
                <span className={styles.demandValue}>{demand.toLocaleString('pl-PL')}</span>
              </div>
            ))}
          </div>
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
