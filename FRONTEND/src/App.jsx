import { useState, useEffect } from 'react'
import { GameProvider, useGame } from './context/GameContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import ResourceBar from './components/ResourceBar/ResourceBar'
import CompanyMenu from './components/CompanyMenu/CompanyMenu'
import Login from './components/Login/Login'
import styles from './App.module.css'

function AnalogClockWrapper() {
  const { gameDate } = useGame()
  if (!gameDate) return null

  const size = 48
  const cx = size / 2, cy = size / 2
  const r = size / 2 - 2

  const h = gameDate.getHours() % 12
  const m = gameDate.getMinutes()
  const hourAngle = (h + m / 60) / 12 * 360 - 90
  const minAngle  = m / 60 * 360 - 90

  const hand = (angle, len, width, color) => {
    const rad = angle * Math.PI / 180
    return (
      <line x1={cx} y1={cy}
        x2={cx + Math.cos(rad) * len} y2={cy + Math.sin(rad) * len}
        stroke={color} strokeWidth={width} strokeLinecap="round"
      />
    )
  }

  // 12 kresek co 5 minut — grubsze przy 12/3/6/9
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI
    const isQuarter = i % 3 === 0
    const inner = isQuarter ? r - 6 : r - 4
    return (
      <line key={i}
        x1={cx + Math.cos(a) * inner} y1={cy + Math.sin(a) * inner}
        x2={cx + Math.cos(a) * r}     y2={cy + Math.sin(a) * r}
        stroke="#ffffff"
        strokeWidth={isQuarter ? 2.5 : 1.5}
      />
    )
  })


  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      {/* Tarcza */}
      <circle cx={cx} cy={cy} r={r} fill="#111111" stroke="#555555" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#333333" strokeWidth={1} />
      {ticks}
      {/* Wskazówki */}
      {hand(hourAngle, r * 0.5, 3,   '#ffffff')}
      {hand(minAngle,  r * 0.78, 2,  '#ffffff')}
      {/* Środek */}
      <circle cx={cx} cy={cy} r={3} fill="#f0c040" />
    </svg>
  )
}

function Clock() {
  const { gameDate } = useGame()
  if (!gameDate) return null

  const hh = String(gameDate.getHours()).padStart(2, '0')
  const mm = String(gameDate.getMinutes()).padStart(2, '0')
  const ss = String(gameDate.getSeconds()).padStart(2, '0')
  const dd = String(gameDate.getDate()).padStart(2, '0')
  const MM = String(gameDate.getMonth() + 1).padStart(2, '0')
  const yyyy = gameDate.getFullYear()
  const dni = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
  const dzien = dni[gameDate.getDay()]

  return (
    <div className={styles.clock} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#4a6a4a', letterSpacing: '1px' }}>
        {dzien}
      </span>
      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 16, color: '#8aab8a', letterSpacing: '1px' }}>
        {dd}.{MM}.{yyyy}
      </span>
      <div>
        <span className={styles.clockTime}>{hh}:{mm}</span>
        <span className={styles.clockSec}>{ss}</span>
      </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>🚂</span>
              <span className={styles.logoText}>TRAIN<strong>MANAGER</strong></span>
            </div>
            <AnalogClockWrapper />
            <div style={{ transform: 'scale(0.75)', transformOrigin: 'left center' }}>
              <Clock />
            </div>
          </div>

          <ResourceBar />

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', borderLeft: '1px solid #2a4a2a', paddingLeft: '16px' }}>
              <span style={{ fontSize: '9px', letterSpacing: '1px', color: '#6a8a6a', fontFamily: "'Share Tech Mono', monospace" }}>
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
