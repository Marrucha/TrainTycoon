import { useState } from 'react'
import { useGame } from '../../../context/GameContext'
import styles from '../RoutePanel.module.css'

const CREW_ROLES = [
  { key: 'maszynista',        label: 'Maszynista',         array: false, required: true  },
  { key: 'kierownik',         label: 'Kierownik',          array: false, required: true  },
  { key: 'pomocnikMaszynisty',label: 'Pomocnik masz.',     array: false, required: false },
  { key: 'konduktorzy',       label: 'Konduktorzy',        array: true,  required: false },
  { key: 'barman',            label: 'Barman',             array: false, required: false },
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


export default function CrewSection({ ts }) {
  const { employees } = useGame()
  const [open, setOpen] = useState(false)

  const crew = ts.crew || {}
  const empById = Object.fromEntries(employees.map(e => [e.id, e]))

  function empLabel(empId) {
    if (!empId) return null
    const e = empById[empId]
    if (!e) return empId.slice(-6)
    if (e.isIntern) return `${e.name} [staż. ${e.role}]`
    return `${e.name} (${Math.round(e.experience ?? 0)})`
  }

  const effectiveMax = ts.effectiveMaxSpeed ?? ts.maxSpeed ?? '—'
  const hasBarman    = !!crew.barman
  const hasHelper    = !!crew.pomocnikMaszynisty

  return (
    <div className={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>OBSADA</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!open && (
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: crew.maszynista ? '#6a9a6a' : '#c0392b' }}>
              M:{crew.maszynista ? '✓' : '✗'}
            </span>
          )}
          {!open && (
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: crew.kierownik ? '#6a9a6a' : '#c0392b' }}>
              K:{crew.kierownik ? '✓' : '✗'}
            </span>
          )}
          <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
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

          {CREW_ROLES.map(({ key, label, array, required }) => {
            const val = crew[key]
            const ids = array ? (val || []) : (val ? [val] : [])

            return (
              <div key={key} className={styles.statRow} style={{ borderBottom: '1px solid #1a2a1a' }}>
                <span className={styles.statLabel} style={{ color: required && ids.length === 0 ? '#e74c3c' : undefined, minWidth: 110 }}>
                  {label}{required && ids.length === 0 ? ' !' : ''}
                </span>
                <span className={styles.statValue} style={{ color: ids.length === 0 ? '#444' : undefined }}>
                  {ids.length === 0 ? 'Nieprzypisany' : ids.map(id => empLabel(id)).join(', ')}
                </span>
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
      )}
    </div>
  )
}
