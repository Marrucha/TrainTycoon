import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import ScheduleModal from './ScheduleModal'
import styles from './RoutePanel.module.css'

export default function RoutePanel() {
  const { selectedRoute, selectRoute, getTrainById, getCityById } = useGame()
  const [modalOpen, setModalOpen] = useState(false)

  if (!selectedRoute) return null

  const from = getCityById(selectedRoute.from)
  const to = getCityById(selectedRoute.to)
  const train = getTrainById(selectedRoute.trainId)
  const totalRevenue = (selectedRoute.dailyRevenue || 0) + (selectedRoute.subsidy || 0)
  const hours = Math.floor(selectedRoute.travelTime / 60)
  const mins = selectedRoute.travelTime % 60
  const travelStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <div className={styles.panel}>
      {/* Nagłówek */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => selectRoute(selectedRoute)}>
          ← wróć
        </button>
        <div className={styles.routeTitle}>
          <span className={styles.cities}>{from?.name} ↔ {to?.name}</span>
          <span className={styles.meta}>{selectedRoute.distance} km · ~{travelStr}</span>
        </div>
      </div>

      <div className={styles.body}>
        {/* Pociąg */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>PRZYPISANY POCIĄG</div>
          {train ? (
            <div className={styles.trainCard}>
              <span className={styles.trainType}>{train.type}</span>
              <span className={styles.trainName}>{train.name}</span>
              <span className={styles.trainDetail}>{train.seats} miejsc · {train.speed} km/h</span>
            </div>
          ) : (
            <div className={styles.noTrain}>
              Brak pociągu — ta trasa nie generuje przychodów
            </div>
          )}
        </section>

        {/* Rozkład */}
        <section className={styles.section}>
          <div className={styles.sectionLabelRow}>
            <span className={styles.sectionLabel}>ROZKŁAD JAZDY</span>
            <span className={styles.depCount}>
              {selectedRoute.departures.length} kursów / dobę
            </span>
          </div>
          {selectedRoute.departures.length > 0 ? (
            <div className={styles.schedule}>
              {selectedRoute.departures.map((dep) => (
                <span key={dep} className={styles.depTime}>{dep}</span>
              ))}
            </div>
          ) : (
            <div className={styles.emptySchedule}>Brak kursów — dodaj rozkład</div>
          )}
          <button className={styles.editBtn} onClick={() => setModalOpen(true)}>
            EDYTUJ ROZKŁAD
          </button>
        </section>

        {/* Statystyki */}
        {train && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>STATYSTYKI</div>
            <div className={styles.stats}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Bilet</span>
                <span className={styles.statValue}>{selectedRoute.ticketPrice} PLN</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Wypełnienie</span>
                <span className={styles.statValue}>
                  {selectedRoute.avgOccupancy
                    ? `${Math.round(selectedRoute.avgOccupancy * 100)}%`
                    : '—'}
                </span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Bilety / doba</span>
                <span className={styles.statValue}>
                  {selectedRoute.dailyRevenue
                    ? `+${selectedRoute.dailyRevenue.toLocaleString('pl-PL')} PLN`
                    : '—'}
                </span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Subsydium</span>
                <span className={styles.statValue}>
                  {selectedRoute.subsidy
                    ? `+${selectedRoute.subsidy.toLocaleString('pl-PL')} PLN`
                    : '—'}
                </span>
              </div>
              <div className={`${styles.statRow} ${styles.total}`}>
                <span className={styles.statLabel}>RAZEM / DOBA</span>
                <span className={styles.statValueGreen}>
                  +{totalRevenue.toLocaleString('pl-PL')} PLN
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      {modalOpen && (
        <ScheduleModal
          route={selectedRoute}
          fromName={from?.name}
          toName={to?.name}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
