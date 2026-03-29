import { useState } from 'react'
import { calcAge, calcTenure, retirementDate, formatDate } from '../../../utils/dateHelpers'
import { useGame } from '../../../context/GameContext'

export const ROLES = [
  { key: 'maszynista', label: 'Maszyniści',  plural: true },
  { key: 'kierownik',  label: 'Kierownicy',  plural: true },
  { key: 'pomocnik',   label: 'Pomocnicy',   plural: true },
  { key: 'konduktor',  label: 'Konduktorzy', plural: true },
  { key: 'barman',     label: 'Barmani',     plural: true },
]

export const ROLE_LABELS = {
  maszynista: 'maszynista',
  kierownik:  'kierownik pociągu',
  pomocnik:   'pomocnik maszynisty',
  konduktor:  'konduktor',
  barman:     'barman',
}

export function EmpTooltip({ emp }) {
  const { gameConstants, gameDate } = useGame()
  const SALARIES = gameConstants?.SALARIES ?? { maszynista: 9000, kierownik: 7000, pomocnik: 6000, konduktor: 5000, barman: 4500 }
  const INTERN_SALARY = gameConstants?.INTERN_SALARY ?? 4300

  const [show, setShow] = useState(false)
  const age     = calcAge(emp.dateOfBirth, gameDate)
  const tenure  = calcTenure(emp.hiredAt, gameDate)
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

export function ExpBar({ value }) {
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

export function MentorPickModal({ intern, employees, onAssign, onUnassign, onClose }) {
  const busyMentorIds = new Set(
    (employees || [])
      .filter(e => e.isIntern && e.mentorId && e.id !== intern.id)
      .map(e => e.mentorId)
  )
  const mentors = (employees || []).filter(
    e => e.role === intern.role && !e.isIntern && e.id !== intern.id && !busyMentorIds.has(e.id)
  )
  const currentMentor = (employees || []).find(e => e.id === intern.mentorId)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20, minWidth: 360, maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 'bold', color: '#eee' }}>Mentor dla: {intern.name}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
          Rola: <span style={{ color: '#f1c40f' }}>{ROLE_LABELS[intern.role] || intern.role}</span>
          {' — '}stażysta zawsze podąża za mentorem
        </div>
        {currentMentor && (
          <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: '#2ecc71' }}>Mentor: {currentMentor.name}</div>
              {currentMentor.assignedTo && <div style={{ fontSize: 11, color: '#888' }}>Skład: {currentMentor.assignedTo}</div>}
            </div>
            <button
              onClick={onUnassign}
              style={{ background: 'none', border: '1px solid #c0392b', color: '#c0392b', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              Odpisz
            </button>
          </div>
        )}
        {mentors.length === 0 && (
          <div style={{ color: '#888', fontSize: 12, padding: '12px 0' }}>
            Brak wykwalifikowanych pracowników roli {ROLE_LABELS[intern.role] || intern.role}.
          </div>
        )}
        {mentors.map(mentor => (
          <div key={mentor.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #222' }}>
            <div>
              <div style={{ color: '#ddd', fontSize: 13 }}>{mentor.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>
                exp: {Math.round(mentor.experience ?? 0)}
                {mentor.assignedTo ? <span style={{ color: '#666', marginLeft: 6 }}>• {mentor.assignedTo}</span> : <span style={{ color: '#444', marginLeft: 6 }}>• wolny</span>}
              </div>
            </div>
            <button
              onClick={() => onAssign(mentor.id)}
              style={{
                background: intern.mentorId === mentor.id ? '#1a3a1a' : '#0a1a0a',
                border: `1px solid ${intern.mentorId === mentor.id ? '#2ecc71' : '#2a4a2a'}`,
                color: intern.mentorId === mentor.id ? '#2ecc71' : '#8aab8a',
                borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer'
              }}
            >
              {intern.mentorId === mentor.id ? '✔ Mentor' : 'Wybierz'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgencyModal({ role, agencyList, onHire, onClose }) {
  const { gameConstants } = useGame()
  const SALARIES = gameConstants?.SALARIES ?? { maszynista: 9000, kierownik: 7000, pomocnik: 6000, konduktor: 5000, barman: 4500 }
  const AGENCY_FEE_MULTIPLIER = gameConstants?.AGENCY_FEE_MULTIPLIER ?? 6

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
