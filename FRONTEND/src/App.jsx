import { useState, useEffect } from 'react'
import { GameProvider } from './context/GameContext'
import PolandMap from './components/Map/PolandMap'
import Sidebar from './components/Sidebar/Sidebar'
import ResourceBar from './components/ResourceBar/ResourceBar'
import FleetMenu from './components/FleetMenu/FleetMenu'
import ReportsMenu from './components/Reports/ReportsMenu'
import CompanyMenu from './components/CompanyMenu/CompanyMenu'
import styles from './App.module.css'

function Clock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hh = String(time.getHours()).padStart(2, '0')
  const mm = String(time.getMinutes()).padStart(2, '0')
  const ss = String(time.getSeconds()).padStart(2, '0')

  return (
    <div className={styles.clock}>
      <span className={styles.clockTime}>{hh}:{mm}</span>
      <span className={styles.clockSec}>{ss}</span>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('company')

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
              className={`${styles.navBtn} ${activeTab === 'company' ? styles.active : ''}`}
              onClick={() => setActiveTab('company')}
            >
              Zarządzanie
            </button>
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
            <button
              className={`${styles.navBtn} ${activeTab === 'reports' ? styles.active : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              Raporty
            </button>
          </nav>

          <ResourceBar />

          <Clock />
        </header>

        <main className={styles.main}>
          {activeTab === 'company' && <CompanyMenu />}
          {activeTab === 'map' && (
            <>
              <section className={styles.mapSection}>
                <PolandMap />
              </section>
              <Sidebar />
            </>
          )}
          {activeTab === 'fleet' && <FleetMenu />}
          {activeTab === 'reports' && <ReportsMenu />}
        </main>
      </div>
    </GameProvider>
  )
}
