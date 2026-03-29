import { doc, setDoc, writeBatch } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'

export const DEPOSIT_TYPES = [
  { key: 'daily',      label: 'Dzienna',    days: 1,   defaultRate: 0.02  },
  { key: 'threeDay',   label: '3-dniowa',   days: 3,   defaultRate: 0.022 },
  { key: 'weekly',     label: 'Tygodniowa', days: 7,   defaultRate: 0.024 },
  { key: 'monthly',    label: 'Miesięczna', days: 30,  defaultRate: 0.026 },
  { key: 'quarterly',  label: 'Kwartalna',  days: 90,  defaultRate: 0.028 },
  { key: 'semiAnnual', label: 'Półroczna',  days: 180, defaultRate: 0.029 },
  { key: 'yearly',     label: 'Roczna',     days: 365, defaultRate: 0.03  },
]

export const DEFAULT_DEPOSIT_RATES = Object.fromEntries(
  DEPOSIT_TYPES.map(t => [t.key, t.defaultRate])
)

export function useFinanceActions({ budget, playerDoc, gameConstants }) {
  async function takeLoan(amount, months = 12) {
    try {
      const batch = writeBatch(db)
      const loanId = `loan_${Date.now()}`

      const steps = [20000000, 50000000, 100000000, 200000000]
      const stepIndex = steps.indexOf(amount)
      const interestRate = 0.05 + (stepIndex > 0 ? stepIndex * 0.002 : 0)

      const totalToRepay = amount * (1 + interestRate)
      const monthlyPayment = totalToRepay / months

      const newLoan = {
        id: loanId,
        principal: amount,
        totalToRepay,
        monthlyPayment,
        remainingMonths: months,
        takenAt: gameDate.toISOString(),
      }

      const currentLoans = playerDoc.finance?.loans || []

      batch.set(doc(db, 'players', auth.currentUser.uid), {
        finance: { balance: budget + amount, loans: [...currentLoans, newLoan] }
      }, { merge: true })

      await batch.commit()
      alert(`Przyznano kredyt inwestycyjny: ${amount.toLocaleString()} PLN. Harmonogram spłat został utworzony.`)
      return true
    } catch (e) {
      console.error('Błąd podczas brania kredytu:', e)
      return false
    }
  }

  async function openCreditLine(limit) {
    const ANNUAL_RATE = gameConstants?.ANNUAL_RATE ?? 0.06
    const COMMITMENT_RATE = gameConstants?.COMMITMENT_RATE ?? 0.01
    const monthlyCommitment = Math.round(limit * COMMITMENT_RATE / 12)
    try {
      await setDoc(doc(db, 'players', auth.currentUser.uid), {
        finance: {
          balance: budget + limit,
          creditLine: {
            limit,
            annualRate: ANNUAL_RATE,
            commitmentRate: COMMITMENT_RATE,
            openedAt: gameDate.toISOString(),
          },
        },
      }, { merge: true })
      alert(`Otwarto linię kredytową na kwotę ${limit.toLocaleString()} PLN.\nOpłata za gotowość: 1% rocznie (${monthlyCommitment.toLocaleString()} PLN/m-c).\nOdsetki od użytej kwoty: 6% rocznie — naliczane codziennie.`)
      return true
    } catch (e) {
      console.error('Błąd podczas otwierania linii kredytowej:', e)
      return false
    }
  }

  async function openDeposit(amount, typeKey, depositRates) {
    const type = DEPOSIT_TYPES.find(t => t.key === typeKey)
    if (!type) return false

    const annualRate = depositRates?.[typeKey] ?? type.defaultRate
    const rate = (type.days / 365) * annualRate

    if (!amount || amount <= 0 || amount > budget) {
      alert('Nieprawidłowa kwota lokaty!')
      return false
    }

    try {
      const batch = writeBatch(db)
      const depositId = `dep_${Date.now()}`
      const createdAt = gameDate
      const matureAt = new Date(createdAt.getTime() + type.days * 24 * 60 * 60 * 1000)

      batch.set(doc(db, `players/${auth.currentUser.uid}/deposits`, depositId), {
        id: depositId,
        amount,
        type: typeKey,
        label: type.label,
        rate,
        annualRate,
        days: type.days,
        createdAt: createdAt.toISOString(),
        matureAt: matureAt.toISOString(),
      })

      batch.set(doc(db, 'players', auth.currentUser.uid), {
        finance: { balance: budget - amount }
      }, { merge: true })

      await batch.commit()
      return true
    } catch (e) {
      console.error('Błąd zakładania lokaty:', e)
      return false
    }
  }

  async function breakDeposit(depositId, amount) {
    if (!window.confirm(`Zerwać lokatę? Odsetki przepadną — odzyskasz tylko kapitał: ${amount.toLocaleString()} PLN.`)) return false
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, `players/${auth.currentUser.uid}/deposits`, depositId))
      batch.set(doc(db, 'players', auth.currentUser.uid), {
        finance: { balance: budget + amount }
      }, { merge: true })
      await batch.commit()
      return true
    } catch (e) {
      console.error('Błąd zerwania lokaty:', e)
      return false
    }
  }

  async function emitShares(dilutionPct) {
    const company = playerDoc.company ?? { totalShares: 1000000, playerShares: 1000000, stockPrice: 100, freeFloat: 0, shareholders: [], emissions: [] }
    const { totalShares, playerShares, stockPrice, freeFloat = 0, shareholders, emissions } = company

    const newShares = Math.round(totalShares * dilutionPct / (1 - dilutionPct))
    const newTotalShares = totalShares + newShares

    const emission = {
      id: `em_${Date.now()}`,
      date: gameDate.toISOString(),
      sharesIssued: newShares,
      pricePerShare: stockPrice,
      buyers: [],
    }

    try {
      await setDoc(doc(db, 'players', auth.currentUser.uid), {
        company: {
          totalShares: newTotalShares,
          playerShares,
          stockPrice,
          freeFloat: freeFloat + newShares,
          shareholders,
          emissions: [...emissions, emission],
        },
      }, { merge: true })
      return true
    } catch (e) {
      console.error('Błąd emisji akcji:', e)
      return false
    }
  }

  return { takeLoan, openCreditLine, openDeposit, breakDeposit, emitShares }
}
;