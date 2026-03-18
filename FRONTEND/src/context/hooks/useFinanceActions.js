import { doc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'

export function useFinanceActions({ budget, playerDoc }) {
  async function takeLoan(amount, months = 12) {
    try {
      const batch = writeBatch(db)
      const loanId = `loan_${Date.now()}`

      // Bazowo 5%, +0.2% za każdy kolejny próg (20, 50, 100, 200)
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
        takenAt: new Date().toISOString(),
      }

      const currentLoans = playerDoc.finance?.loans || []

      batch.set(doc(db, 'players', 'player1'), {
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
    try {
      await setDoc(doc(db, 'players', 'player1'), {
        finance: {
          balance: budget + limit,
          creditLine: {
            limit,
            openedAt: new Date().toISOString(),
            monthlyCommitmentFee: limit * 0.001,
          },
        },
      }, { merge: true })
      alert(`Otwarto linię kredytową na kwotę ${limit.toLocaleString()} PLN. Miesięczny koszt gotowości: ${(limit * 0.001).toLocaleString()} PLN.`)
      return true
    } catch (e) {
      console.error('Błąd podczas otwierania linii kredytowej:', e)
      return false
    }
  }

  return { takeLoan, openCreditLine }
}
