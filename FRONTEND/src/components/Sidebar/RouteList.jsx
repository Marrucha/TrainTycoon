import { motion } from 'framer-motion'
import { useGame } from '../../context/GameContext'
import styles from './RouteList.module.css'

export default function RouteList() {
  const { routes, selectedRoute, selectRoute, getTrainById, getCityById } = useGame()

  const active = routes.filter((r) => r.trainId)
  const inactive = routes.filter((r) => !r.trainId)

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <span className={styles.title}>TRASY</span>
        <span className={styles.summary}>
          {active.length} aktywnych · {inactive.length} bez pociągu
        </span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>● AKTYWNE</div>
        {active.map((route) => (
          <RouteRow
            key={route.id}
            route={route}
            isSelected={selectedRoute?.id === route.id}
            onSelect={selectRoute}
            getTrainById={getTrainById}
            getCityById={getCityById}
          />
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>○ BEZ POCIĄGU</div>
        {inactive.map((route) => (
          <RouteRow
            key={route.id}
            route={route}
            isSelected={selectedRoute?.id === route.id}
            onSelect={selectRoute}
            getTrainById={getTrainById}
            getCityById={getCityById}
          />
        ))}
      </div>
    </div>
  )
}

function RouteRow({ route, isSelected, onSelect, getTrainById, getCityById }) {
  const fromCity = getCityById(route.from)
  const toCity = getCityById(route.to)
  const train = getTrainById(route.trainId)
  const totalRevenue = (route.dailyRevenue || 0) + (route.subsidy || 0)

  return (
    <motion.div
      className={`${styles.row} ${isSelected ? styles.selected : ''} ${route.trainId ? styles.active : ''}`}
      onClick={() => onSelect(route)}
      whileHover={{ x: 3 }}
      transition={{ duration: 0.1 }}
    >
      <div className={styles.routeName}>
        <span className={styles.indicator}>{route.trainId ? '●' : '○'}</span>
        <span className={styles.cities}>
          {fromCity?.name} ↔ {toCity?.name}
        </span>
        <span className={styles.distance}>{route.distance} km</span>
      </div>
      <div className={styles.routeMeta}>
        {train ? (
          <>
            <span className={styles.trainBadge}>{train.type}</span>
            <span className={styles.trainName}>{train.name}</span>
          </>
        ) : (
          <span className={styles.noTrain}>brak pociągu</span>
        )}
        {totalRevenue > 0 && (
          <span className={styles.revenue}>+{totalRevenue.toLocaleString('pl-PL')} PLN/d</span>
        )}
      </div>
    </motion.div>
  )
}
