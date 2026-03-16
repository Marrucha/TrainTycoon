import { motion } from 'framer-motion'
import { useGame } from '../../context/GameContext'
import styles from './RouteList.module.css'

export default function RouteList() {
  const { trainsSets, getCityById, companyName, selectTrainSet, selectedTrainSet } = useGame()

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
          <TrainSetRow key={ts.id} trainSet={ts} getCityById={getCityById} companyName={companyName} isSelected={selectedTrainSet?.id === ts.id} onSelect={selectTrainSet} />
        ))}
        {trainsSets.length === 0 && (
          <div className={styles.noTrain} style={{ padding: '8px 16px' }}>brak składów</div>
        )}
      </div>
    </div>
  )
}

function TrainSetRow({ trainSet, getCityById, companyName, isSelected, onSelect }) {
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
