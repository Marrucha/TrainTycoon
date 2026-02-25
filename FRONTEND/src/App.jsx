import { GameProvider } from './context/GameContext'
import PolandMap from './components/Map/PolandMap'
import Sidebar from './components/Sidebar/Sidebar'
import ResourceBar from './components/ResourceBar/ResourceBar'
import styles from './App.module.css'

export default function App() {
  return (
    <GameProvider>
      <div className={styles.app}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🚂</span>
            <span className={styles.logoText}>TRAIN<strong>MANAGER</strong></span>
          </div>
          <ResourceBar />
        </header>

        <main className={styles.main}>
          <section className={styles.mapSection}>
            <PolandMap />
          </section>
          <Sidebar />
        </main>
      </div>
    </GameProvider>
  )
}
