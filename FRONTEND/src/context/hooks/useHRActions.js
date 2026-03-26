import { doc, setDoc, addDoc, deleteDoc, updateDoc, collection, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'

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

export function useHRActions({ budget, trainsSets, employees }) {
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
      const uid     = auth.currentUser.uid
      const hiredAt = new Date().toISOString().slice(0, 10)
      await addDoc(collection(db, `players/${uid}/kadry`), {
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

      // Remove hired candidate from agencyList
      const playerRef  = doc(db, 'players', uid)
      const playerSnap = await getDoc(playerRef)
      const currentList = playerSnap.data()?.agencyList || []
      const updatedList = currentList.filter(c =>
        !(c.name === name && c.role === role && String(c.experience) === String(experience))
      )

      await setDoc(playerRef, {
        finance:    { balance: budget - fee },
        agencyList: updatedList,
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
      await addDoc(collection(db, `players/${auth.currentUser.uid}/kadry`), {
        name:              _randomName(),
        role,
        experience:        0.0,
        monthlySalary:     INTERN_SALARY,
        hiredAt:           hiredAt.toISOString().slice(0, 10),
        isIntern:          true,
        internGraduatesAt: null,   // set when mentor is assigned
        mentorId:          null,
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
    // Severance tiers (hiredAt counts from start of internship):
    // < 12 months → 1×, 12–36 months → 2×, > 36 months → 3×
    // Interns (still in training) get 0 severance
    const severance = isIntern ? 0
      : monthsEmployed > 36 ? 3 * monthlySalary
      : monthsEmployed >= 12 ? 2 * monthlySalary
      : monthlySalary

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
            await updateDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, assignedTo), updates)
          }
        }
      }

      await deleteDoc(doc(db, `players/${auth.currentUser.uid}/kadry`, empId))

      if (severance > 0) {
        await setDoc(doc(db, 'players', auth.currentUser.uid), {
          finance: { balance: budget - severance },
        }, { merge: true })
      }
      return true
    } catch (e) {
      console.error('Błąd zwolnienia pracownika:', e)
      return false
    }
  }

  // ─── Intern helpers ────────────────────────────────────────────────────────

  // Finds all interns whose mentor is empId and moves them to newTsId (or null)
  async function _syncInterns(empId, newTsId, oldTsId) {
    const uid = auth.currentUser.uid
    const interns = (employees || []).filter(e => e.isIntern && e.mentorId === empId)
    await Promise.all(interns.map(async intern => {
      const internRef = doc(db, `players/${uid}/kadry`, intern.id)
      const ops = [updateDoc(internRef, { assignedTo: newTsId ?? null })]
      if (oldTsId) ops.push(updateDoc(doc(db, `players/${uid}/trainSet`, oldTsId), { 'crew.stazysci': arrayRemove(intern.id) }))
      if (newTsId) ops.push(updateDoc(doc(db, `players/${uid}/trainSet`, newTsId), { 'crew.stazysci': arrayUnion(intern.id) }))
      await Promise.all(ops)
    }))
  }

  // ─── Assign intern to mentor ────────────────────────────────────────────────

  async function assignInternToMentor(internId, mentorEmpId) {
    const uid = auth.currentUser.uid
    try {
      const currentIntern = (employees || []).find(e => e.id === internId)
      const mentorEmp     = (employees || []).find(e => e.id === mentorEmpId)
      const mentorTsId    = mentorEmp?.assignedTo ?? null
      const oldTsId       = currentIntern?.assignedTo ?? null

      // Graduation = 1 year from today (mentor assigned)
      const graduatesAt = new Date()
      graduatesAt.setFullYear(graduatesAt.getFullYear() + 1)

      const internRef = doc(db, `players/${uid}/kadry`, internId)
      const ops = [updateDoc(internRef, {
        mentorId: mentorEmpId,
        assignedTo: mentorTsId,
        internGraduatesAt: graduatesAt.toISOString().slice(0, 10),
      })]
      if (oldTsId) ops.push(updateDoc(doc(db, `players/${uid}/trainSet`, oldTsId), { 'crew.stazysci': arrayRemove(internId) }))
      if (mentorTsId) ops.push(updateDoc(doc(db, `players/${uid}/trainSet`, mentorTsId), { 'crew.stazysci': arrayUnion(internId) }))
      await Promise.all(ops)
      return true
    } catch (e) {
      console.error('Błąd przypisywania stażysty do mentora:', e)
      return false
    }
  }

  // ─── Unassign intern from mentor ────────────────────────────────────────────

  async function unassignInternFromMentor(internId) {
    const uid = auth.currentUser.uid
    try {
      const currentIntern = (employees || []).find(e => e.id === internId)
      const oldTsId = currentIntern?.assignedTo ?? null
      const internRef = doc(db, `players/${uid}/kadry`, internId)
      const ops = [updateDoc(internRef, { mentorId: null, assignedTo: null, internGraduatesAt: null })]
      if (oldTsId) ops.push(updateDoc(doc(db, `players/${uid}/trainSet`, oldTsId), { 'crew.stazysci': arrayRemove(internId) }))
      await Promise.all(ops)
      return true
    } catch (e) {
      console.error('Błąd odpinania stażysty od mentora:', e)
      return false
    }
  }

  // ─── Assign crew ───────────────────────────────────────────────────────────

  async function assignCrew(tsId, role, empId) {
    const crewKey = ROLE_KEY_MAP[role] ?? role
    const isArray = ARRAY_ROLES.includes(crewKey)
    const uid = auth.currentUser.uid
    try {
      const tsRef  = doc(db, `players/${uid}/trainSet`, tsId)
      const empRef = doc(db, `players/${uid}/kadry`, empId)

      const crewUpdate = isArray
        ? { [`crew.${crewKey}`]: arrayUnion(empId) }
        : { [`crew.${crewKey}`]: empId }

      if (crewKey === 'pomocnikMaszynisty') {
        const ts = trainsSets?.find(t => t.id === tsId)
        if (ts) crewUpdate.effectiveMaxSpeed = ts.maxSpeed ?? 160
      }

      const oldTsId = (employees || []).find(e => e.id === empId)?.assignedTo ?? null
      await Promise.all([
        updateDoc(tsRef,  crewUpdate),
        updateDoc(empRef, { assignedTo: tsId }),
      ])
      // Move interns along with their mentor
      await _syncInterns(empId, tsId, oldTsId !== tsId ? oldTsId : null)
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
    const uid = auth.currentUser.uid
    try {
      const tsRef  = doc(db, `players/${uid}/trainSet`, tsId)
      const empRef = doc(db, `players/${uid}/kadry`, empId)

      const crewUpdate = isArray
        ? { [`crew.${crewKey}`]: arrayRemove(empId) }
        : { [`crew.${crewKey}`]: null }

      if (crewKey === 'pomocnikMaszynisty') {
        const ts = trainsSets?.find(t => t.id === tsId)
        if (ts) crewUpdate.effectiveMaxSpeed = Math.min(ts.maxSpeed ?? 160, 130)
      }

      await Promise.all([
        updateDoc(tsRef,  crewUpdate),
        updateDoc(empRef, { assignedTo: null }),
      ])
      // Unassign interns when mentor leaves the trainSet
      await _syncInterns(empId, null, tsId)
      return true
    } catch (e) {
      console.error('Błąd usuwania obsady:', e)
      return false
    }
  }

  return { hireFromAgency, hireIntern, fireEmployee, assignCrew, unassignCrew, assignInternToMentor, unassignInternFromMentor }
}
;