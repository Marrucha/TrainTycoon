import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../../context/GameContext'
import DepartureBoard from '../DepartureBoard/DepartureBoard'
import RouteList from './RouteList'
import RoutePanel from './RoutePanel'
import styles from './Sidebar.module.css'

export default function Sidebar() {
  const { selectedCity, selectedRoute } = useGame()

  return (
    <aside className={styles.sidebar}>
      <AnimatePresence mode="wait">
        {selectedCity && (
          <motion.div
            key="city"
            className={styles.panel}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <DepartureBoard />
          </motion.div>
        )}
        {selectedRoute && !selectedCity && (
          <motion.div
            key="route"
            className={styles.panel}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <RoutePanel />
          </motion.div>
        )}
        {!selectedCity && !selectedRoute && (
          <motion.div
            key="list"
            className={styles.panel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <RouteList />
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}
