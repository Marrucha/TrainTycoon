import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../context/GameContext'
import styles from './DepartureBoard.module.css'

function FlipCell({ value }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        className={styles.flipCell}
        initial={{ rotateX: -90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        exit={{ rotateX: 90, opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  )
}

export default function DepartureBoard() {
  const { selectedCity, getDeparturesForCity, selectCity, cities, companyName, trainsSets, getCityById } = useGame()
  const [demandTab, setDemandTab] = useState(0)

  const departures = selectedCity ? getDeparturesForCity(selectedCity.id) : []

  // Popyt globalny (gravity model) — z pola demand na dokumencie miasta
  const demandEntries = selectedCity?.demand
    ? Object.entries(selectedCity.demand)
        .map(([cityId, demand]) => ({ cityId, demand, name: cities.find(c => c.id === cityId)?.name ?? cityId }))
        .sort((a, b) => b.demand - a.demand)
    : []

  // Popyt z backendu (dailyDemand) — jeden wpis na kurs, dla tego miasta jako stacji odjazdu
  const cityId = selectedCity?.id
  const kursDemand = []
  if (cityId && trainsSets?.length) {
    for (const ts of trainsSets) {
      if (!ts.dailyDemand || !ts.rozklad?.length) continue

      // Grupuj rozkład po kursie
      const byKurs = {}
      for (const stop of ts.rozklad) {
        if (stop.kurs == null) continue
        if (!byKurs[stop.kurs]) byKurs[stop.kurs] = []
        byKurs[stop.kurs].push(stop)
      }

      for (const [kursId, kursData] of Object.entries(ts.dailyDemand)) {
        const stops = byKurs[kursId] || []
        // Znajdź przystanek w tym mieście
        const cityStop = stops.find(s =>
          cities.find(c => (c.id === s.miasto || c.name === s.miasto) && c.id === cityId)
        )
        if (!cityStop) continue

        // OD tylko z tego miasta jako punktu startowego
        const od = {}
        for (const [key, val] of Object.entries(kursData.od || {})) {
          if (!key.startsWith(cityId + ':')) continue
          od[key] = val
        }
        if (Object.keys(od).length === 0) continue

        const total = Object.values(od).reduce((s, v) => s + v.class1 + v.class2, 0)
        kursDemand.push({
          id: `${ts.id}-${kursId}`,
          tsName: ts.name || ts.id,
          kursId,
          odjazd: cityStop.odjazd || '—',
          kierunek: cityStop.kierunek || '—',
          od,
          total,
        })
      }
    }
    kursDemand.sort((a, b) => (a.odjazd || '').localeCompare(b.odjazd || ''))
  }

  const hasDemandData = demandEntries.length > 0 || kursDemand.length > 0

  return (
    <div className={styles.board}>
      {/* Nagłówek */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => selectCity(selectedCity)}>
            ← wróć
          </button>
          <span className={styles.stationName}>
            {selectedCity?.name.toUpperCase() ?? ''}
          </span>
          <span className={styles.title}>ODJAZDY</span>
        </div>
        <Clock />
      </div>

      {/* Nagłówki kolumn rozkładu */}
      <div className={styles.colHeaders}>
        <span>GODZ.</span>
        <span>KIERUNEK</span>
        <span>NR POCIĄGU</span>
        <span>PERON</span>
        <span>POCIĄG / PRZEWOŹNIK</span>
        <span>STATUS</span>
      </div>

      {/* Wiersze rozkładu */}
      <div className={styles.departureList}>
        {departures.length > 0 ? (
          <AnimatePresence>
            {departures.map((dep) => (
              <motion.div
                key={dep.id}
                className={`${styles.rowWrapper} ${dep.status === 'BOARDING' ? styles.boardingRow : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className={styles.row}>
                  <span className={styles.time}>
                    <FlipCell value={dep.departure} />
                  </span>
                  <span className={styles.destination}>{dep.destination}</span>
                  <span className={styles.trainNo}>
                    {dep.trainNo != null ? `${dep.trainNo}/${dep.kurs}` : '—'}
                  </span>
                  <span className={styles.platform}>{dep.platform}</span>
                  <div className={styles.trainCell}>
                    <span className={styles.trainId}>{dep.trainId}</span>
                    {companyName && <span className={styles.carrier}>{companyName}</span>}
                  </div>
                  <span className={`${styles.status} ${dep.status === 'BOARDING' ? styles.boarding : styles.onTime}`}>
                    {dep.status}
                  </span>
                </div>
                {dep.via?.length > 0 && (
                  <div className={styles.viaLine}>
                    przez: {dep.via.join(' · ')}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className={styles.empty}>
            Brak kursów z tej stacji
          </div>
        )}
      </div>

      {/* Dolna sekcja popytu z zakładkami */}
      {hasDemandData && (
        <div className={styles.demandSection}>
          <div className={styles.demandTabs}>
            <button
              className={`${styles.demandTab} ${demandTab === 0 ? styles.demandTabActive : ''}`}
              onClick={() => setDemandTab(0)}
            >
              POPYT GLOBALNY
            </button>
            <button
              className={`${styles.demandTab} ${demandTab === 1 ? styles.demandTabActive : ''}`}
              onClick={() => setDemandTab(1)}
            >
              POPYT USŁUG
            </button>
          </div>

          {/* Popyt globalny */}
          {demandTab === 0 && (
            demandEntries.length > 0 ? (
              <div className={styles.demandGrid}>
                {demandEntries.map(({ cityId, name, demand }) => (
                  <div key={cityId} className={styles.demandRow}>
                    <span className={styles.demandCity}>{name}</span>
                    <span className={styles.demandValue}>{demand.toLocaleString('pl-PL')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.demandEmpty}>Brak danych popytu globalnego</div>
            )
          )}

          {/* Popyt usług backendu — jeden wpis na kurs */}
          {demandTab === 1 && (
            kursDemand.length > 0 ? (
              <div className={styles.serviceList}>
                {kursDemand.map((entry) => (
                  <div key={entry.id} className={styles.tsCard}>
                    <div className={styles.tsHeader}>
                      <div className={styles.tsHeaderLeft}>
                        <span className={styles.tsTime}>{entry.odjazd}</span>
                        <span className={styles.tsName}>{entry.tsName}</span>
                        <span className={styles.tsDir}>→ {entry.kierunek}</span>
                      </div>
                      <span className={styles.tsTotal}>{entry.total.toLocaleString('pl-PL')} os.</span>
                    </div>
                    <div className={styles.tsOdHeader}>
                      <span>DO</span>
                      <span>KL.1</span>
                      <span>KL.2</span>
                    </div>
                    {Object.entries(entry.od)
                      .sort((a, b) => (b[1].class1 + b[1].class2) - (a[1].class1 + a[1].class2))
                      .map(([key, val]) => {
                        const destId = key.split(':')[1]
                        const destName = getCityById(destId)?.name ?? destId
                        return (
                          <div key={key} className={styles.tsOdRow}>
                            <span className={styles.tsOdCity}>{destName}</span>
                            <span className={styles.tsOdVal}>{val.class1}</span>
                            <span className={styles.tsOdVal}>{val.class2}</span>
                          </div>
                        )
                      })}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.demandEmpty}>Brak danych popytu dla tej stacji</div>
            )
          )}
        </div>
      )}
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <span className={styles.clock}>
      {time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}
