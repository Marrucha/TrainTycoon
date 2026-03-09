import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../../context/GameContext'
import DepartureBoard from '../DepartureBoard/DepartureBoard'
import RouteList from './RouteList'
import RouteSegmentPanel from './RouteSegmentPanel'
import TrainSetPanel from './TrainSetPanel'
import styles from './Sidebar.module.css'

export default function Sidebar() {
  const { selectedCity, selectedRoute, selectedTrainSet } = useGame()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <button
        className={styles.toggleBtn}
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Rozwiń panel' : 'Zwiń panel'}
      >
        {collapsed ? '◀' : '▶'}
      </button>

      <div className={styles.content}>
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
          {selectedRoute && !selectedCity && !selectedTrainSet && (
            <motion.div
              key="segment"
              className={styles.panel}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <RouteSegmentPanel />
            </motion.div>
          )}
          {selectedTrainSet && !selectedCity && (
            <motion.div
              key="trainset"
              className={styles.panel}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <TrainSetPanel />
            </motion.div>
          )}
          {!selectedCity && !selectedTrainSet && !selectedRoute && (
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
      </div>
    </aside>
  )
}
