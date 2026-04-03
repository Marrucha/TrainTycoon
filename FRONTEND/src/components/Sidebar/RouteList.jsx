import { motion } from 'framer-motion'
import { useGame } from '../../context/GameContext'
import styles from './RouteList.module.css'

function NewBadge({ ts, timeMultiplier }) {
  const oneGameMonthMs = 30 * 24 * 3600 * 1000 / (timeMultiplier || 30)
  const color = !ts.createdAt ? null
    : !ts.firstRouteAt ? 'red'
    : (Date.now() - new Date(ts.firstRouteAt).getTime()) < oneGameMonthMs ? 'green'
    : null
  if (!color) return null
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1,
      padding: '1px 5px', borderRadius: 3, flexShrink: 0,
      background: color === 'red' ? 'rgba(231,76,60,0.2)' : 'rgba(46,204,113,0.2)',
      border: `1px solid ${color === 'red' ? '#e74c3c' : '#2ecc71'}`,
      color: color === 'red' ? '#e74c3c' : '#2ecc71',
    }}>NEW</span>
  )
}

export default function RouteList() {
  const { trainsSets, getCityById, companyName, selectTrainSet, selectedTrainSet, gameConstants } = useGame()
  const timeMultiplier = gameConstants?.TIME_MULTIPLIER || 30

  const active = trainsSets.filter((ts) => ts.routeStops?.length > 0)
  const inactive = trainsSets.filter((ts) => !ts.routeStops?.length)

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <span className={styles.title}>TRASY</span>
        <span className={styles.summary}>
          {active.length} aktywnych · {inactive.length} bez trasy
        </span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>● WSZYSTKIE SKŁADY</div>
        {trainsSets.map((ts) => (
          <TrainSetRow key={ts.id} trainSet={ts} getCityById={getCityById} companyName={companyName} isSelected={selectedTrainSet?.id === ts.id} onSelect={selectTrainSet} timeMultiplier={timeMultiplier} />
        ))}
        {trainsSets.length === 0 && (
          <div className={styles.noTrain} style={{ padding: '8px 16px' }}>brak składów</div>
        )}
      </div>
    </div>
  )
}

function TrainSetRow({ trainSet, getCityById, companyName, isSelected, onSelect, timeMultiplier }) {
  const stops = trainSet.routeStops || []
  const fromCity = getCityById(stops[0])
  const toCity = getCityById(stops[stops.length - 1])
  const viaStops = stops.slice(1, -1).map((id) => getCityById(id)?.name || id)

  const coursesCount = trainSet.rozklad?.length
    ? new Set(trainSet.rozklad.map((s) => s.kurs)).size
    : 0

  const hasRoute = stops.length > 0

  return (
    <motion.div
      className={`${styles.row} ${hasRoute ? styles.active : ''} ${isSelected ? styles.selected : ''}`}
      onClick={() => onSelect(trainSet)}
      whileHover={{ x: 3 }}
      transition={{ duration: 0.1 }}
    >
      <div className={styles.routeName}>
        <span className={styles.indicator} style={!hasRoute ? { color: '#e74c3c', fontSize: '14px' } : {}}>●</span>
        <span className={styles.cities}>
          {hasRoute
            ? `${fromCity?.name || stops[0]} ↔ ${toCity?.name || stops[stops.length - 1]}`
            : trainSet.name}
        </span>
        <NewBadge ts={trainSet} timeMultiplier={timeMultiplier} />
      </div>
      {viaStops.length > 0 && (
        <div className={styles.via}>via: {viaStops.join(' · ')}</div>
      )}
      <div className={styles.routeMeta}>
        <span className={styles.trainBadge}>{companyName || trainSet.type}</span>
        <span className={styles.trainName}>{trainSet.name}</span>
        {coursesCount > 0 && (
          <span className={styles.revenue}>{coursesCount} kursów/d</span>
        )}
      </div>
    </motion.div>
  )
}
