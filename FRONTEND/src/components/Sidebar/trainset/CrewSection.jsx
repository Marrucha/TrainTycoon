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

const ROLE_KEY_TO_EMP = {
  maszynista:         'maszynista',
  kierownik:          'kierownik',
  pomocnikMaszynisty: 'pomocnik',
  konduktorzy:        'konduktor',
  barman:             'barman',
}

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

function AssignModal({ role, roleLabel, tsId, excludeIds, onAssign, onClose }) {
  const { employees } = useGame()
  const empRole = ROLE_KEY_TO_EMP[role] ?? role
  const candidates = employees.filter(
    e => e.role === empRole && !e.isIntern && !e.assignedTo && !excludeIds.has(e.id)
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 18, minWidth: 300, maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: '#eee', fontWeight: 'bold', fontSize: 13 }}>Przypisz – {roleLabel}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
        </div>
        {candidates.length === 0 && (
          <div style={{ color: '#666', fontSize: 12 }}>Brak wolnych pracowników tej roli. Zatrudnij w sekcji Kadry.</div>
        )}
        {candidates.map(emp => (
          <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1a1a1a' }}>
            <div>
              <div style={{ color: '#ddd', fontSize: 12 }}>{emp.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>exp: {Math.round(emp.experience ?? 0)}</div>
            </div>
            <button
              onClick={() => onAssign(emp.id)}
              style={{ background: '#1a3a1a', border: '1px solid #27ae60', color: '#27ae60', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              Przypisz
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CrewSection({ ts }) {
  const { employees, assignCrew, unassignCrew } = useGame()
  const [assignRole, setAssignRole] = useState(null)

  const crew = ts.crew || {}

  // All assigned employee IDs in this trainSet (to exclude from candidates)
  const allAssignedIds = new Set([
    crew.maszynista,
    crew.kierownik,
    crew.pomocnikMaszynisty,
    ...(crew.konduktorzy || []),
    crew.barman,
  ].filter(Boolean))

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

  async function handleAssign(empId) {
    await assignCrew(ts.id, assignRole, empId)
    setAssignRole(null)
  }

  async function handleUnassign(role, empId) {
    await unassignCrew(ts.id, role, empId)
  }

  return (
    <div className={styles.section}>
      {assignRole && (
        <AssignModal
          role={assignRole}
          roleLabel={CREW_ROLES.find(r => r.key === assignRole)?.label ?? assignRole}
          tsId={ts.id}
          excludeIds={allAssignedIds}
          onAssign={handleAssign}
          onClose={() => setAssignRole(null)}
        />
      )}

      <div className={styles.sectionTitle}>Obsada</div>

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
          <div key={key} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: required && ids.length === 0 ? '#e74c3c' : '#888', minWidth: 110 }}>
                {label}{required && ids.length === 0 ? ' !' : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {ids.length === 0 && (
                  <span style={{ fontSize: 11, color: '#444', marginRight: 4 }}>Nieprzypisany</span>
                )}
                {ids.map(id => (
                  <span key={id} style={{ fontSize: 11, color: '#ccc', marginRight: 4 }}>{empLabel(id)}</span>
                ))}
                <button
                  onClick={() => setAssignRole(key)}
                  style={{ background: 'none', border: '1px solid #333', color: '#888', borderRadius: 3, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                >
                  {ids.length === 0 ? 'Przypisz' : '+'}
                </button>
                {ids.map(id => (
                  <button
                    key={`rm-${id}`}
                    onClick={() => handleUnassign(key, id)}
                    style={{ background: 'none', border: '1px solid #422', color: '#c0392b', borderRadius: 3, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                  >
                    −
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Summary stats */}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#888' }}>Gapowicze</span>
          <GapBar rate={ts.gapowiczeRate} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#888' }}>Max prędkość</span>
          <span style={{ fontSize: 11, color: hasHelper ? '#2ecc71' : '#f39c12' }}>
            {effectiveMax} km/h{!hasHelper ? ' (bez pomocnika)' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#888' }}>Wars</span>
          <span style={{ fontSize: 11, color: hasBarman ? '#2ecc71' : '#555' }}>
            {hasBarman ? 'aktywny' : 'brak barmana'}
          </span>
        </div>
      </div>
    </div>
  )
}
