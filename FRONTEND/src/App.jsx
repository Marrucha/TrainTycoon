import { useState, useEffect } from 'react'
import { GameProvider } from './context/GameContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import ResourceBar from './components/ResourceBar/ResourceBar'
import CompanyMenu from './components/CompanyMenu/CompanyMenu'
import Login from './components/Login/Login'
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

function MainApp() {
  const { currentUser, logout } = useAuth()

  if (!currentUser) {
    return <Login />
  }

  return (
    <GameProvider>
      <div className={styles.app}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🚂</span>
            <span className={styles.logoText}>TRAIN<strong>MANAGER</strong></span>
          </div>
          
          <ResourceBar />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
            <Clock />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #2a4a2a', paddingLeft: '16px' }}>
              <span style={{ fontWeight: 'bold', color: '#ff8c00' }}>
                Witaj, {currentUser?.displayName || currentUser?.email?.split('@')[0]}!
              </span>
              <button 
                onClick={logout} 
                style={{ 
                  background: 'rgba(255, 68, 68, 0.1)', 
                  border: '1px solid rgba(255, 68, 68, 0.2)', 
                  color: '#ff4444', 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 68, 68, 0.2)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 68, 68, 0.1)'}
              >
                Wyloguj
              </button>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <CompanyMenu />
        </main>
      </div>
    </GameProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}
