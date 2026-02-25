import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../context/GameContext'
import styles from './ScheduleModal.module.css'

export default function ScheduleModal({ route, fromName, toName, onClose }) {
  const { updateRouteSchedule } = useGame()
  const [departures, setDepartures] = useState([...route.departures].sort())
  const [newTime, setNewTime] = useState('')
  const [error, setError] = useState('')

  function addDeparture() {
    if (!newTime) { setError('Podaj godzinę'); return }
    if (departures.includes(newTime)) { setError('Ta godzina już istnieje'); return }
    setDepartures((prev) => [...prev, newTime].sort())
    setNewTime('')
    setError('')
  }

  function removeDeparture(time) {
    setDepartures((prev) => prev.filter((d) => d !== time))
  }

  function handleSave() {
    updateRouteSchedule(route.id, departures)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <div className={styles.header}>
          <div className={styles.title}>EDYTUJ ROZKŁAD</div>
          <div className={styles.routeName}>{fromName} ↔ {toName}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Dodaj godzinę */}
        <div className={styles.addRow}>
          <input
            type="time"
            className={styles.timeInput}
            value={newTime}
            onChange={(e) => { setNewTime(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && addDeparture()}
          />
          <button className={styles.addBtn} onClick={addDeparture}>
            + DODAJ
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}

        {/* Lista godzin */}
        <div className={styles.depList}>
          <AnimatePresence>
            {departures.length === 0 && (
              <div className={styles.empty}>Brak kursów — dodaj godzinę odjazdu</div>
            )}
            {departures.map((dep) => (
              <motion.div
                key={dep}
                className={styles.depRow}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
              >
                <span className={styles.depTime}>{dep}</span>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeDeparture(dep)}
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className={styles.footer}>
          <span className={styles.count}>{departures.length} kursów / dobę</span>
          <button className={styles.cancelBtn} onClick={onClose}>ANULUJ</button>
          <button className={styles.saveBtn} onClick={handleSave}>ZAPISZ</button>
        </div>
      </motion.div>
    </div>
  )
}
