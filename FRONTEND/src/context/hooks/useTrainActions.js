import { doc, writeBatch, updateDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'

export function useTrainActions({ baseTrains, budget }) {
  async function buyTrain(baseTrainId) {
    const baseTrain = baseTrains.find((t) => t.id === baseTrainId)
    if (!baseTrain) return false

    const vehiclePrice = baseTrain.price || ((baseTrain.speed || 100) * (baseTrain.seats || 50) * 100)

    if (budget < vehiclePrice) {
      alert('Niewystarczające środki na koncie!')
      return false
    }

    try {
      const batch = writeBatch(db)
      const newTrainId = `pt_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`
      const purchasedAt = gameDate.toISOString()

      batch.set(doc(db, `players/${auth.currentUser.uid}/trains/${newTrainId}`), {
        id: newTrainId,
        parent_id: baseTrain.id,
        name: `${baseTrain.name} #${Math.floor(Math.random() * 900) + 100}`,
        purchasedAt,
        lastMaintenance: purchasedAt,
        lastOverhaul: purchasedAt,
      })

      batch.set(doc(db, 'players', auth.currentUser.uid), { finance: { balance: budget - vehiclePrice } }, { merge: true })

      await batch.commit()
      alert(`Zakupiono pociąg! Kwota ${vehiclePrice.toLocaleString()} PLN pomyślnie pobrana z konta.`)
      return true
    } catch (e) {
      console.error('Błąd podczas zakupu pociągu:', e)
      return false
    }
  }

  async function performMaintenance(trainId) {
    try {
      await updateDoc(doc(db, `players/${auth.currentUser.uid}/trains/${trainId}`), {
        lastMaintenance: gameDate.toISOString(),
      })
      return true
    } catch (e) {
      console.error('Błąd podczas ręcznej konserwacji:', e)
      return false
    }
  }

  async function disbandTrainSet(trainSetId, allEmployees) {
    try {
      const batch = writeBatch(db)

      if (allEmployees) {
        allEmployees.forEach(emp => {
          if (emp.assignedTo === trainSetId) {
            batch.update(doc(db, `players/${auth.currentUser.uid}/kadry/${emp.id}`), {
              assignedTo: null
            })
          }
        })
      }

      const tsRef = doc(db, `players/${auth.currentUser.uid}/trainSet/${trainSetId}`)
      batch.update(tsRef, {
        trainIds: [],
        crew: {},
        totalSeats: 0,
        totalCostPerKm: 0,
        maxSpeed: 0,
        effectiveMaxSpeed: 0,
        gapowiczeRate: 0,
        noCrewAlert: false
      })

      await batch.commit()
      return true
    } catch (e) {
      console.error('Błąd podczas rozwiązywania składu:', e)
      return false
    }
  }

  return { buyTrain, performMaintenance, disbandTrainSet }
}
