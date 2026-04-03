import { useState } from 'react'
import { useGame } from '../../../context/GameContext'
import styles from '../RoutePanel.module.css'
import ConfirmButton from '../../common/ConfirmButton'

const CREW_ROLES = [
  { key: 'maszynista',         role: 'maszynista',  label: 'Maszynista',        array: false, required: true  },
  { key: 'kierownik',          role: 'kierownik',   label: 'Kierownik',         array: false, required: true  },
  { key: 'pomocnikMaszynisty', role: 'pomocnik',    label: 'Pomocnik masz.',    array: false, required: false },
  { key: 'konduktorzy',        role: 'konduktor',   label: 'Konduktorzy',       array: true,  required: false },
  { key: 'barman',             role: 'barman',      label: 'Barman',            array: false, required: false },
]

function GapBar({ rate }) {
  const pct = Math.round((rate || 0) * 100)
  const color = pct < 10 ? '#2ecc71' : pct < 25 ? '#f39c12' : '#e74c3c'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct * 2, 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color, minWidth: 28 }}>{pct}%</span>
    </div>
  )
}

export default function CrewSection({ ts, editable = false }) {
  const { employees, assignCrew, unassignCrew } = useGame()
  const [busy, setBusy] = useState(false)

  const crew = ts.crew || {}
  const empById = Object.fromEntries(employees.map(e => [e.id, e]))

  function empLabel(empId) {
    if (!empId) return null
    const e = empById[empId]
    if (!e) return empId.slice(-6)
    if (e.isIntern) return `${e.name} [staż. ${e.role}]`
    return `${e.name} (${Math.round(e.experience ?? 0)})`
  }

  async function handleAssign(crewKey, role, empId) {
    if (!empId || busy) return
    setBusy(true)
    await assignCrew(ts.id, crewKey, empId)
    setBusy(false)
  }

  async function handleUnassign(crewKey, role, empId) {
    if (!empId || busy) return
    setBusy(true)
    await unassignCrew(ts.id, crewKey, empId, { confirmed: true })
    setBusy(false)
  }

  const effectiveMax = ts.effectiveMaxSpeed ?? ts.maxSpeed ?? '—'
  const hasBarman    = !!crew.barman
  const hasHelper    = !!crew.pomocnikMaszynisty

  return (
    <div className={styles.section}>
      <div>
        {ts.noCrewAlert && (
          <div style={{
            background: 'rgba(230,126,34,0.15)', border: '1px solid #e67e22',
            borderRadius: 6, padding: '8px 10px', marginBottom: 8,
            display: 'flex', alignItems: 'flex-start', gap: 8
          }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>⚠️</span>
            <div>
              <div style={{ color: '#e67e22', fontWeight: 'bold', fontSize: 11, marginBottom: 2 }}>
                POCIĄG UNIERUCHOMIONY
              </div>
              <div style={{ color: '#b0804a', fontSize: 10 }}>
                Brak wymaganej obsady. Przypisz maszynistę i kierownika, aby wznowić kursy.
              </div>
            </div>
          </div>
        )}

        {CREW_ROLES.map(({ key, role, label, array, required }) => {
          const val = crew[key]
          const ids = array ? (val || []) : (val ? [val] : [])

          // Wolni pracownicy pasujący do roli (nie przypisani do innego składu)
          const available = editable
            ? employees.filter(e =>
                e.role === role &&
                !e.isIntern &&
                (!e.assignedTo || e.assignedTo === ts.id) &&
                !ids.includes(e.id)
              )
            : []

          return (
            <div key={key} className={styles.statRow} style={{ borderBottom: '1px solid #1a2a1a', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span className={styles.statLabel} style={{ color: required && ids.length === 0 ? '#e74c3c' : undefined, minWidth: 110 }}>
                  {label}{required && ids.length === 0 ? ' !' : ''}
                </span>
                <span className={styles.statValue} style={{ color: ids.length === 0 ? '#444' : undefined, fontSize: 11 }}>
                  {ids.length === 0 ? 'Nieprzypisany' : ids.map(id => empLabel(id)).join(', ')}
                </span>
              </div>

              {editable && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingBottom: 4 }}>
                  {/* Przyciski odpięcia */}
                  {ids.map(empId => (
                    <ConfirmButton
                      key={empId}
                      label={`− ${empLabel(empId)}`}
                      confirmLabel="Odpiąć?"
                      onConfirm={() => handleUnassign(key, role, empId)}
                      disabled={busy}
                      btnStyle={{ fontSize: 10, padding: '2px 6px', background: 'rgba(231,76,60,0.15)', border: '1px solid #c0392b', color: '#e74c3c', borderRadius: 3, cursor: 'pointer' }}
                    />
                  ))}
                  {/* Dropdown przypisania */}
                  {(array || ids.length === 0) && available.length > 0 && (
                    <select
                      disabled={busy}
                      defaultValue=""
                      onChange={e => { if (e.target.value) handleAssign(key, role, e.target.value); e.target.value = '' }}
                      style={{ fontSize: 10, padding: '2px 4px', background: '#0f1f0f', border: '1px solid #27ae60', color: '#2ecc71', borderRadius: 3, cursor: 'pointer' }}
                    >
                      <option value="">+ Przypisz...</option>
                      {available.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({Math.round(e.experience ?? 0)} exp)
                        </option>
                      ))}
                    </select>
                  )}
                  {(array || ids.length === 0) && available.length === 0 && (
                    <span style={{ fontSize: 10, color: '#555', fontStyle: 'italic' }}>brak wolnych pracowników</span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Summary stats */}
        <div className={styles.stats} style={{ marginTop: 8 }}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Gapowicze</span>
            <GapBar rate={ts.gapowiczeRate} />
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Max prędkość</span>
            <span style={{ fontSize: 11, color: hasHelper ? '#2ecc71' : '#f39c12' }}>
              {effectiveMax} km/h{!hasHelper ? ' (bez pomocnika)' : ''}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Wars</span>
            <span className={styles.statValue} style={{ color: hasBarman ? '#2ecc71' : '#555' }}>
              {hasBarman ? 'aktywny' : 'brak barmana'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
