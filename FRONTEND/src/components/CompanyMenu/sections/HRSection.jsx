import { useState } from 'react'
import { useGame } from '../../../context/GameContext'
import styles from '../CompanyMenu.module.css'
import ConfirmButton from '../../common/ConfirmButton'

const _H = import.meta.env.VITE_FUNCTIONS_HASH
const fnUrl = (name) => `https://${name}-${_H}-uc.a.run.app`

import { calcAge, retirementDate, formatDate } from '../../../utils/dateHelpers'
import { ROLES, EmpTooltip, ExpBar, MentorPickModal, AgencyModal } from './HRSectionComponents'

export default function HRSection() {
  const { employees, trainsSets, playerDoc, hireFromAgency, hireIntern, fireEmployee, assignInternToMentor, unassignInternFromMentor, gameConstants } = useGame()
  const SALARIES = gameConstants?.SALARIES ?? { maszynista: 9000, kierownik: 7000, pomocnik: 6000, konduktor: 5000, barman: 4500 }
  const INTERN_SALARY = gameConstants?.INTERN_SALARY ?? 4300
  const [activeRole, setActiveRole] = useState('maszynista')
  const [showAgency, setShowAgency] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [internAssignFor, setInternAssignFor] = useState(null) // intern emp object

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

  // Employees for the active role tab (non-interns + their interns listed below)
  const filtered = employees.filter(e => e.role === activeRole && !e.isIntern)
  const internsForRole = employees.filter(e => e.role === activeRole && e.isIntern)

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
    await fireEmployee(emp.id, emp, { confirmed: true })
  }

  async function handleInternAssign(mentorId) {
    await assignInternToMentor(internAssignFor.id, mentorId)
    setInternAssignFor(null)
  }

  async function handleInternUnassign() {
    await unassignInternFromMentor(internAssignFor.id)
    setInternAssignFor(null)
  }

  return (
    <>
      {internAssignFor && (
        <MentorPickModal
          intern={internAssignFor}
          employees={employees}
          trainsSets={trainsSets}
          onAssign={handleInternAssign}
          onUnassign={handleInternUnassign}
          onClose={() => setInternAssignFor(null)}
        />
      )}
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
        {filtered.length === 0 && internsForRole.length === 0 && (
          <div style={{ color: '#666', fontSize: 12, padding: '8px 0' }}>Brak pracowników w tej kategorii.</div>
        )}
        {filtered.map(emp => {
          const age       = calcAge(emp.dateOfBirth)
          const preRetire = age !== null && age >= 63
          const retDate   = retirementDate(emp.dateOfBirth)
          const myIntern  = internsForRole.find(i => i.mentorId === emp.id)

          return (
          <div key={emp.id}>
            {/* Karta mentora */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 6px', borderBottom: myIntern ? 'none' : '1px solid #1a1a1a',
              borderLeft: preRetire ? '3px solid #e74c3c' : '3px solid transparent',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <EmpTooltip emp={emp} />
                  {preRetire && (
                    <span style={{ fontSize: 10, color: '#e74c3c', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>
                      Emerytura {retDate ? retDate.toLocaleDateString('pl-PL') : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: '#666' }}>exp:</span>
                  <ExpBar value={emp.experience ?? 0} />
                  <span style={{ fontSize: 11, color: '#666' }}>
                    {emp.assignedTo
                      ? <span>Przyp.: <span style={{ color: '#aaa' }}>{tsName(emp.assignedTo)}</span></span>
                      : <span style={{ color: '#555' }}>Wolny</span>
                    }
                  </span>
                </div>
              </div>
              <ConfirmButton
                label="Zwolnij"
                confirmLabel="Zwolnić?"
                onConfirm={() => handleFire(emp)}
                disabled={preRetire}
                btnStyle={{ background: 'none', border: '1px solid #555', color: preRetire ? '#555' : '#c0392b', borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: preRetire ? 'not-allowed' : 'pointer', opacity: preRetire ? 0.4 : 1, flexShrink: 0 }}
              />
            </div>
            {/* Karta stażysty pod mentorem */}
            {myIntern && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 6px 8px 18px', borderBottom: '1px solid #1a1a1a',
                borderLeft: '3px solid #e67e22', background: 'rgba(230,126,34,0.04)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: '#e67e22', fontSize: 10 }}>└ stażysta:</span>
                    <EmpTooltip emp={myIntern} />
                    {myIntern.internGraduatesAt && (
                      <span style={{ fontSize: 11, color: '#888' }}>uprawn.: {formatDate(myIntern.internGraduatesAt)}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => setInternAssignFor(myIntern)}
                    style={{ background: 'none', border: '1px solid #2980b9', color: '#2980b9', borderRadius: 3, padding: '2px 7px', fontSize: 10, cursor: 'pointer' }}
                  >
                    Zmień
                  </button>
                  <ConfirmButton
                    label="Zwolnij"
                    confirmLabel="Zwolnić?"
                    onConfirm={() => handleFire(myIntern)}
                    btnStyle={{ background: 'none', border: '1px solid #555', color: '#c0392b', borderRadius: 3, padding: '2px 7px', fontSize: 10, cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}
          </div>
          )
        })}
        {/* Stażyści bez mentora */}
        {internsForRole.filter(i => !i.mentorId).map(intern => (
          <div key={intern.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 6px', borderBottom: '1px solid #1a1a1a',
            borderLeft: '3px solid #888', background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: '#888', fontSize: 10 }}>stażysta (bez mentora):</span>
                <EmpTooltip emp={intern} />
                <span style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>czas nie biegnie</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => setInternAssignFor(intern)}
                style={{ background: 'none', border: '1px solid #2980b9', color: '#2980b9', borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
              >
                Przypisz mentora
              </button>
              <ConfirmButton
                label="Zwolnij"
                confirmLabel="Zwolnić?"
                onConfirm={() => handleFire(intern)}
                btnStyle={{ background: 'none', border: '1px solid #555', color: '#c0392b', borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
              />
            </div>
          </div>
        ))}

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
