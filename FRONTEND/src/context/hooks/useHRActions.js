import { doc, setDoc, addDoc, deleteDoc, updateDoc, collection, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase/config'

const _FIRST_NAMES = [
  'Adam', 'Piotr', 'Marek', 'Tomasz', 'Andrzej', 'Krzysztof', 'Michał',
  'Paweł', 'Łukasz', 'Grzegorz', 'Jan', 'Robert', 'Mariusz', 'Kamil',
  'Bartosz', 'Marcin', 'Jarosław', 'Dariusz', 'Mateusz', 'Rafał',
  'Anna', 'Katarzyna', 'Małgorzata', 'Agnieszka', 'Barbara', 'Ewa',
  'Maria', 'Monika', 'Joanna', 'Beata',
]
const _LAST_NAMES = [
  'Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński',
  'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski',
  'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk',
  'Grabowski', 'Nowakowski', 'Pawlak', 'Michalski', 'Adamczyk',
  'Dudek', 'Zając', 'Wieczorek', 'Jabłoński', 'Kaczmarek', 'Sobczak',
  'Czajkowski', 'Baran', 'Zawadzki',
]

function _randomName() {
  const first = _FIRST_NAMES[Math.floor(Math.random() * _FIRST_NAMES.length)]
  const last  = _LAST_NAMES[Math.floor(Math.random() * _LAST_NAMES.length)]
  return `${first} ${last}`
}

function _randomDob(minAge, maxAge) {
  const now = new Date()
  const age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1))
  const y   = now.getFullYear() - age
  const m   = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
  const d   = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function _calcAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  const now   = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

export const SALARIES = {
  maszynista: 9000,
  kierownik:  7000,
  pomocnik:   6000,
  konduktor:  5000,
  barman:     4500,
}
export const INTERN_SALARY = 4300
export const AGENCY_FEE_MULTIPLIER = 6  // 6× monthly salary

const ARRAY_ROLES = ['konduktorzy', 'stazysci']
const ROLE_KEY_MAP = {
  maszynista:        'maszynista',
  kierownik:         'kierownik',
  pomocnik:          'pomocnikMaszynisty',
  pomocnikMaszynisty:'pomocnikMaszynisty',
  konduktor:         'konduktorzy',
  barman:            'barman',
}

export function useHRActions({ budget, trainsSets }) {
  // ─── Hire from agency ──────────────────────────────────────────────────────

  async function hireFromAgency(candidateData) {
    const { role, experience, name } = candidateData
    const salary = SALARIES[role] ?? 5000
    const fee    = AGENCY_FEE_MULTIPLIER * salary
    if (budget < fee) {
      alert(`Niewystarczające środki. Prowizja agencji: ${fee.toLocaleString()} PLN`)
      return false
    }
    try {
      const hiredAt = new Date().toISOString().slice(0, 10)
      await addDoc(collection(db, 'players/player1/kadry'), {
        name,
        role,
        experience:    parseFloat(experience),
        monthlySalary: salary,
        hiredAt,
        isIntern:      false,
        internGraduatesAt: null,
        assignedTo:    null,
        dateOfBirth:   candidateData.dateOfBirth ?? null,
      })
      await setDoc(doc(db, 'players', 'player1'), {
        finance: { balance: budget - fee },
      }, { merge: true })
      return true
    } catch (e) {
      console.error('Błąd zatrudnienia przez agencję:', e)
      return false
    }
  }

  // ─── Hire intern ───────────────────────────────────────────────────────────

  async function hireIntern(role) {
    try {
      const hiredAt = new Date()
      const graduatesAt = new Date(hiredAt)
      graduatesAt.setFullYear(graduatesAt.getFullYear() + 1)

      await addDoc(collection(db, 'players/player1/kadry'), {
        name:              _randomName(),
        role,
        experience:        0.0,
        monthlySalary:     INTERN_SALARY,
        hiredAt:           hiredAt.toISOString().slice(0, 10),
        isIntern:          true,
        internGraduatesAt: graduatesAt.toISOString().slice(0, 10),
        assignedTo:        null,
        dateOfBirth:       _randomDob(20, 24),
      })
      return true
    } catch (e) {
      console.error('Błąd zatrudnienia stażysty:', e)
      return false
    }
  }

  // ─── Fire employee ─────────────────────────────────────────────────────────

  async function fireEmployee(empId, empData) {
    const { monthlySalary = 5000, hiredAt, isIntern, assignedTo, dateOfBirth } = empData
    const age = _calcAge(dateOfBirth)
    if (age !== null && age >= 63) {
      alert('Pracownik w wieku przedemerytalnym (63+) nie może zostać zwolniony.')
      return false
    }
    const hiredDate = hiredAt ? new Date(hiredAt) : new Date()
    const monthsEmployed = Math.floor((Date.now() - hiredDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    const severance = isIntern ? 0 : (monthsEmployed > 36 ? 3 * monthlySalary : monthlySalary)

    const confirmMsg = severance > 0
      ? `Zwolnić pracownika? Odprawa: ${severance.toLocaleString()} PLN.`
      : 'Zwolnić stażystę? Brak odprawy.'
    if (!window.confirm(confirmMsg)) return false

    try {
      // Unassign from crew if assigned
      if (assignedTo) {
        const ts = trainsSets?.find(t => t.id === assignedTo)
        if (ts) {
          const crew    = ts.crew || {}
          const updates = {}
          for (const [crewKey, val] of Object.entries(crew)) {
            if (ARRAY_ROLES.includes(crewKey) && Array.isArray(val) && val.includes(empId)) {
              updates[`crew.${crewKey}`] = arrayRemove(empId)
            } else if (val === empId) {
              updates[`crew.${crewKey}`] = null
            }
          }
          if (Object.keys(updates).length) {
            await updateDoc(doc(db, `players/player1/trainSet`, assignedTo), updates)
          }
        }
      }

      await deleteDoc(doc(db, 'players/player1/kadry', empId))

      if (severance > 0) {
        await setDoc(doc(db, 'players', 'player1'), {
          finance: { balance: budget - severance },
        }, { merge: true })
      }
      return true
    } catch (e) {
      console.error('Błąd zwolnienia pracownika:', e)
      return false
    }
  }

  // ─── Assign crew ───────────────────────────────────────────────────────────

  async function assignCrew(tsId, role, empId) {
    const crewKey = ROLE_KEY_MAP[role] ?? role
    const isArray = ARRAY_ROLES.includes(crewKey)
    try {
      const tsRef  = doc(db, `players/player1/trainSet`, tsId)
      const empRef = doc(db, 'players/player1/kadry', empId)

      const crewUpdate = isArray
        ? { [`crew.${crewKey}`]: arrayUnion(empId) }
        : { [`crew.${crewKey}`]: empId }

      // Recalculate effectiveMaxSpeed when assigning pomocnik
      if (crewKey === 'pomocnikMaszynisty') {
        const ts = trainsSets?.find(t => t.id === tsId)
        if (ts) crewUpdate.effectiveMaxSpeed = ts.maxSpeed ?? 160
      }

      await Promise.all([
        updateDoc(tsRef,  crewUpdate),
        updateDoc(empRef, { assignedTo: tsId }),
      ])
      return true
    } catch (e) {
      console.error('Błąd przypisywania obsady:', e)
      return false
    }
  }

  // ─── Unassign crew ─────────────────────────────────────────────────────────

  async function unassignCrew(tsId, role, empId) {
    const crewKey = ROLE_KEY_MAP[role] ?? role
    const isArray = ARRAY_ROLES.includes(crewKey)
    try {
      const tsRef  = doc(db, `players/player1/trainSet`, tsId)
      const empRef = doc(db, 'players/player1/kadry', empId)

      const crewUpdate = isArray
        ? { [`crew.${crewKey}`]: arrayRemove(empId) }
        : { [`crew.${crewKey}`]: null }

      // Cap speed at 130 when unassigning pomocnik
      if (crewKey === 'pomocnikMaszynisty') {
        const ts = trainsSets?.find(t => t.id === tsId)
        if (ts) crewUpdate.effectiveMaxSpeed = Math.min(ts.maxSpeed ?? 160, 130)
      }

      await Promise.all([
        updateDoc(tsRef,  crewUpdate),
        updateDoc(empRef, { assignedTo: null }),
      ])
      return true
    } catch (e) {
      console.error('Błąd usuwania obsady:', e)
      return false
    }
  }

  return { hireFromAgency, hireIntern, fireEmployee, assignCrew, unassignCrew }
}
