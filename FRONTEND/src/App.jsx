import { useState } from 'react'
import { GameProvider, useGame } from './context/GameContext'
import PolandMap from './components/Map/PolandMap'
import Sidebar from './components/Sidebar/Sidebar'
import ResourceBar from './components/ResourceBar/ResourceBar'
import FleetMenu from './components/FleetMenu/FleetMenu'
import { migrateToFirestore, migrateDemandToCities, migrateHourDemandMap } from './firebase/migration'
import styles from './App.module.css'

function DevTools() {
  const { rebuildAllCitySchedules } = useGame()
  return (
    <div className={styles.devTools}>
      <button onClick={migrateToFirestore}>↑ Migruj dane</button>
      <button onClick={migrateDemandToCities}>↑ Migruj popyt do miast</button>
      <button onClick={migrateHourDemandMap}>↑ Migruj rozkład godz.</button>
      <button onClick={rebuildAllCitySchedules}>↑ Przelicz rozkłady miast</button>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('map')

  return (
    <GameProvider>
      <div className={styles.app}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🚂</span>
            <span className={styles.logoText}>TRAIN<strong>MANAGER</strong></span>
          </div>

          <nav className={styles.nav}>
            <button
              className={`${styles.navBtn} ${activeTab === 'map' ? styles.active : ''}`}
              onClick={() => setActiveTab('map')}
            >
              Mapa Sieci
            </button>
            <button
              className={`${styles.navBtn} ${activeTab === 'fleet' ? styles.active : ''}`}
              onClick={() => setActiveTab('fleet')}
            >
              Flota Pociągów
            </button>
          </nav>

          <ResourceBar />

          {import.meta.env.DEV && <DevTools />}
        </header>

        <main className={styles.main}>
          {activeTab === 'map' ? (
            <>
              <section className={styles.mapSection}>
                <PolandMap />
              </section>
              <Sidebar />
            </>
          ) : (
            <FleetMenu />
          )}
        </main>
      </div>
    </GameProvider>
  )
}
