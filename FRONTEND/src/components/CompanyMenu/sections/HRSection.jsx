import { useState } from 'react'
import { useGame } from '../../../context/GameContext'
import { SALARIES, INTERN_SALARY, AGENCY_FEE_MULTIPLIER } from '../../../context/hooks/useHRActions'
import styles from '../CompanyMenu.module.css'

const _H = import.meta.env.VITE_FUNCTIONS_HASH
const fnUrl = (name) => `https://${name}-${_H}-uc.a.run.app`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcAge(dob) {
  if (!dob) return null
  const b = new Date(dob), now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return a
}

function calcTenure(hiredAt) {
  if (!hiredAt) return '—'
  const months = Math.floor((Date.now() - new Date(hiredAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 1)  return '< 1 mies.'
  if (months < 12) return `${months} mies.`
  const y = Math.floor(months / 12), r = months % 12
  return r > 0 ? `${y} l. ${r} mies.` : `${y} l.`
}

function retirementDate(dob) {
  if (!dob) return null
  const b = new Date(dob)
  return new Date(b.getFullYear() + 65, b.getMonth(), b.getDate())
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Karta pracownika z tooltipem przy najechaniu na imię
function EmpTooltip({ emp }) {
  const [show, setShow] = useState(false)
  const age     = calcAge(emp.dateOfBirth)
  const tenure  = calcTenure(emp.hiredAt)
  const salary  = emp.isIntern ? INTERN_SALARY : (emp.monthlySalary ?? SALARIES[emp.role] ?? 0)
  const retDate = retirementDate(emp.dateOfBirth)

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ color: '#ddd', fontSize: 13, cursor: 'default', borderBottom: '1px dotted #555' }}>
        {emp.name}
      </span>
      {show && (
        <div style={{
          position: 'absolute', bottom: '120%', left: 0, zIndex: 300,
          background: '#111', border: '1px solid #333', borderRadius: 6,
          padding: '8px 12px', minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>{emp.name}</div>
          {age   !== null && <div style={{ fontSize: 11, color: '#8aab8a' }}>Wiek: <span style={{ color: '#fff' }}>{age} l.</span></div>}
          {emp.dateOfBirth && <div style={{ fontSize: 11, color: '#8aab8a' }}>Data ur.: <span style={{ color: '#fff' }}>{formatDate(emp.dateOfBirth)}</span></div>}
          <div style={{ fontSize: 11, color: '#8aab8a' }}>Staż: <span style={{ color: '#fff' }}>{tenure}</span></div>
          <div style={{ fontSize: 11, color: '#8aab8a' }}>Pensja: <span style={{ color: '#f1c40f' }}>{salary.toLocaleString('pl-PL')} PLN/mies.</span></div>
          {retDate && <div style={{ fontSize: 11, color: '#8aab8a', marginTop: 4 }}>Emerytura: <span style={{ color: '#e67e22' }}>{formatDate(retDate)}</span></div>}
        </div>
      )}
    </span>
  )
}

const ROLES = [
  { key: 'maszynista', label: 'Maszyniści',  plural: true },
  { key: 'kierownik',  label: 'Kierownicy',  plural: true },
  { key: 'pomocnik',   label: 'Pomocnicy',   plural: true },
  { key: 'konduktor',  label: 'Konduktorzy', plural: true },
  { key: 'barman',     label: 'Barmani',     plural: true },
]

const ROLE_LABELS = {
  maszynista: 'maszynista',
  kierownik:  'kierownik pociągu',
  pomocnik:   'pomocnik maszynisty',
  konduktor:  'konduktor',
  barman:     'barman',
}

function ExpBar({ value }) {
  const pct = Math.round(value)
  const color = pct >= 70 ? '#27ae60' : pct >= 40 ? '#f39c12' : '#c0392b'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-block', width: 60, height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </span>
      <span style={{ fontSize: 11, color: '#aaa', minWidth: 24 }}>{pct}</span>
    </span>
  )
}

function AgencyModal({ role, agencyList, onHire, onClose }) {
  const candidates = (agencyList || []).filter(c => c.role === role)
  const salary     = SALARIES[role] ?? 5000
  const fee        = AGENCY_FEE_MULTIPLIER * salary

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20, minWidth: 360, maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 'bold', color: '#eee' }}>Agencja – {ROLE_LABELS[role]}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
          Prowizja: <span style={{ color: '#f1c40f' }}>{fee.toLocaleString()} PLN</span> jednorazowo + {salary.toLocaleString()} PLN/m-c
        </div>
        {candidates.length === 0 && (
          <div style={{ color: '#888', fontSize: 12, padding: '12px 0' }}>Brak kandydatów – lista odświeży się jutro.</div>
        )}
        {candidates.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #222' }}>
            <div>
              <div style={{ color: '#ddd', fontSize: 13 }}>{c.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: '#888' }}>Doświadczenie:</span>
                <ExpBar value={c.experience} />
              </div>
            </div>
            <button
              onClick={() => onHire(c)}
              style={{ background: '#1a4a1a', border: '1px solid #2ecc71', color: '#2ecc71', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              Zatrudnij
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HRSection() {
  const { employees, trainsSets, playerDoc, hireFromAgency, hireIntern, fireEmployee } = useGame()
  const [activeRole, setActiveRole] = useState('maszynista')
  const [showAgency, setShowAgency] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function handleGenerateAgencyList() {
    setGenerating(true)
    try {
      const res = await fetch(fnUrl('generate-agency-lists-manual'))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      alert('Lista kandydatów wygenerowana. Odśwież stronę lub poczekaj chwilę.')
    } catch (e) {
      alert(`Błąd: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const agencyList = playerDoc?.agencyList || []

  // Monthly salary total
  const monthlyCost = employees.reduce((sum, e) => {
    return sum + (e.isIntern ? INTERN_SALARY : (e.monthlySalary ?? SALARIES[e.role] ?? 0))
  }, 0)

  // Employees for the active role tab
  const filtered = employees.filter(e => e.role === activeRole)

  // TrainSet name lookup
  const tsName = (tsId) => trainsSets?.find(t => t.id === tsId)?.name || tsId

  // Warnings: trainSets missing maszynista or kierownik
  const warnings = (trainsSets || [])
    .filter(ts => ts.rozklad?.length > 0)
    .flatMap(ts => {
      const crew = ts.crew || {}
      const msgs = []
      if (!crew.maszynista)  msgs.push({ ts, msg: 'brak maszynisty' })
      if (!crew.kierownik)   msgs.push({ ts, msg: 'brak kierownika pociągu' })
      return msgs
    })

  async function handleHireAgency(candidate) {
    const ok = await hireFromAgency(candidate)
    if (ok) setShowAgency(false)
  }

  async function handleFire(emp) {
    await fireEmployee(emp.id, emp)
  }

  return (
    <>
      {showAgency && (
        <AgencyModal
          role={activeRole}
          agencyList={agencyList}
          onHire={handleHireAgency}
          onClose={() => setShowAgency(false)}
        />
      )}

      <div className={styles.sectionHeader}>
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Kadry</span>
          <span style={{ fontSize: 13, fontWeight: 'normal', color: '#aaa' }}>
            Mies. koszt: <span style={{ color: '#f1c40f' }}>{monthlyCost.toLocaleString()} PLN</span>
          </span>
        </h2>
      </div>

      {/* Role tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {ROLES.map(r => {
          const count = employees.filter(e => e.role === r.key).length
          return (
            <button
              key={r.key}
              onClick={() => setActiveRole(r.key)}
              style={{
                background: activeRole === r.key ? '#1a3a1a' : 'rgba(22, 38, 22, 0.75)',
                border: `1px solid ${activeRole === r.key ? '#2ecc71' : 'rgba(138,171,138,0.35)'}`,
                color: activeRole === r.key ? '#2ecc71' : '#8aab8a',
                borderRadius: 4,
                padding: '5px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {r.label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Employee list */}
      <section className={styles.card} style={{ marginBottom: 12 }}>
        {filtered.length === 0 && (
          <div style={{ color: '#666', fontSize: 12, padding: '8px 0' }}>Brak pracowników w tej kategorii.</div>
        )}
        {filtered.map(emp => {
          const age       = calcAge(emp.dateOfBirth)
          const preRetire = age !== null && age >= 63
          const retDate   = retirementDate(emp.dateOfBirth)

          return (
          <div key={emp.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 6px', borderBottom: '1px solid #1a1a1a',
            borderLeft: preRetire ? '3px solid #e74c3c' : '3px solid transparent',
            borderRadius: preRetire ? '2px' : 0,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <EmpTooltip emp={emp} />
                {emp.isIntern && <span style={{ color: '#e67e22', fontSize: 11 }}>[stażysta]</span>}
                {emp.isIntern && emp.internGraduatesAt && (
                  <span style={{ fontSize: 11, color: '#888' }}>→ {emp.internGraduatesAt.slice(0, 7)}</span>
                )}
                {preRetire && (
                  <span style={{ fontSize: 10, color: '#e74c3c', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>
                    Emerytura {retDate ? retDate.toLocaleDateString('pl-PL') : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                {!emp.isIntern && (
                  <>
                    <span style={{ fontSize: 11, color: '#666' }}>exp:</span>
                    <ExpBar value={emp.experience ?? 0} />
                  </>
                )}
                <span style={{ fontSize: 11, color: '#666' }}>
                  {emp.assignedTo
                    ? <span>Przyp.: <span style={{ color: '#aaa' }}>{tsName(emp.assignedTo)}</span></span>
                    : <span style={{ color: '#555' }}>Wolny</span>
                  }
                </span>
              </div>
            </div>
            <button
              onClick={() => !preRetire && handleFire(emp)}
              disabled={preRetire}
              title={preRetire ? 'Pracownik w wieku przedemerytalnym (63+)' : ''}
              style={{ background: 'none', border: '1px solid #555', color: preRetire ? '#555' : '#c0392b', borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: preRetire ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: preRetire ? 0.4 : 1 }}
            >
              Zwolnij
            </button>
          </div>
          )
        })}

        {/* Hire buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowAgency(true)}
            style={{ background: '#1a3a1a', border: '1px solid #27ae60', color: '#27ae60', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
          >
            + Zatrudnij przez Agencję
          </button>
          <button
            onClick={() => hireIntern(activeRole)}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #555', color: '#aaa', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
          >
            + Zatrudnij stażystę
          </button>
          <button
            onClick={handleGenerateAgencyList}
            disabled={generating}
            title="Tymczasowe – generuje nową listę kandydatów agencji"
            style={{ background: 'rgba(241,196,15,0.08)', border: '1px solid #7a6010', color: '#f1c40f', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? '⟳ Generowanie...' : '⚙ Generuj listę'}
          </button>
        </div>
      </section>

      {/* Warnings */}
      {warnings.length > 0 && (
        <section className={styles.card} style={{ borderLeft: '3px solid #e67e22' }}>
          <div style={{ color: '#e67e22', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>⚠ Składy bez wymaganej obsady:</div>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: '#aaa', padding: '2px 0' }}>
              <span style={{ color: '#ddd' }}>{w.ts.name}</span>: {w.msg}
            </div>
          ))}
        </section>
      )}
    </>
  )
}
