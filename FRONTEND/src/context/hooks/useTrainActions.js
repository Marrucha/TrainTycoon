import { doc, writeBatch, updateDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'

export function useTrainActions({ baseTrains, budget, gameDate }) {
  async function buyTrain(baseTrainId, qty = 1) {
    const baseTrain = baseTrains.find((t) => t.id === baseTrainId)
    if (!baseTrain) return false

    const unitPrice = baseTrain.price || ((baseTrain.speed || 100) * (baseTrain.seats || 50) * 100)
    const multiplier = Math.max(0.20, Math.pow(0.995, qty))
    const totalPrice = Math.round(qty * unitPrice * multiplier)

    if (budget < totalPrice) {
      alert('Niewystarczające środki na koncie!')
      return false
    }

    try {
      const batch = writeBatch(db)
      const purchasedAt = gameDate.toISOString()

      for (let i = 0; i < qty; i++) {
        const newTrainId = `pt_${Math.random().toString(36).substr(2, 9)}_${Date.now() + i}`
        batch.set(doc(db, `players/${auth.currentUser.uid}/trains/${newTrainId}`), {
          id: newTrainId,
          parent_id: baseTrain.id,
          name: `${baseTrain.name} #${Math.floor(Math.random() * 900) + 100}`,
          purchasedAt,
          lastMaintenance: purchasedAt,
          lastOverhaul: purchasedAt,
        })
      }

      batch.set(doc(db, 'players', auth.currentUser.uid), { finance: { balance: budget - totalPrice } }, { merge: true })

      await batch.commit()
      const discountPct = Math.round((1 - multiplier) * 100)
      alert(`Zakupiono ${qty} szt.! Kwota ${totalPrice.toLocaleString()} PLN pobrana z konta.${discountPct > 0 ? ` (rabat ${discountPct}%)` : ''}`)
      return true
    } catch (e) {
      console.error('Błąd podczas zakupu pociągu:', e)
      return false
    }
  }

  /**
   * Uruchamia konserwację jednego wagonu.
   * Zapisuje maintenanceStartedAt (real ms) i maintenanceDurationMs
   * proporcjonalne do stopnia zużycia (condition).
   * Frontend może wyliczyć progress: (now - start) / duration.
   * Po zakończeniu (progress >= 1) backend przy EOD / lub frontend
   * po upływie czasu resetuje condition do 1.0.
   */
  async function startMaintenance(trainId, currentCondition = 1.0) {
    try {
      // Czas konserwacji: 0% zużycia = 0 min, 100% zużycia = 2 wirtualne doby
      // W grze ×30: 2 doby wirtualne = 2*24*60*60*1000 / 30 = ~96min realnych
      const timeMultiplier = gameDate ? 30 : 30
      const damage = Math.max(0, 1.0 - currentCondition)
      const maxRepairRealMs = (2 * 24 * 60 * 60 * 1000) / timeMultiplier  // 96 min real przy ×30
      const durationMs = Math.round(damage * maxRepairRealMs)

      const now = Date.now()
      await updateDoc(doc(db, `players/${auth.currentUser.uid}/trains/${trainId}`), {
        maintenanceStartedAt: now,
        maintenanceDurationMs: durationMs || 1000, // min 1s żeby pasek był widoczny
        maintenanceComplete: false,
        lastMaintenance: gameDate?.toISOString() ?? new Date().toISOString(),
      })
      return true
    } catch (e) {
      console.error('Błąd podczas uruchamiania konserwacji:', e)
      return false
    }
  }

  /**
   * Finalizes maintenance — sets condition = 1.0, clears maintenance fields.
   * Called by frontend when progress bar reaches 100%.
   */
  async function completeMaintenance(trainId) {
    try {
      await updateDoc(doc(db, `players/${auth.currentUser.uid}/trains/${trainId}`), {
        condition: 1.0,
        maintenanceComplete: true,
        maintenanceStartedAt: null,
        maintenanceDurationMs: null,
      })
      return true
    } catch (e) {
      console.error('Błąd podczas finalizacji konserwacji:', e)
      return false
    }
  }

  /** Legacy — kept for compatibility */
  async function performMaintenance(trainId) {
    return startMaintenance(trainId, 1.0)
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

  return { buyTrain, performMaintenance, startMaintenance, completeMaintenance, disbandTrainSet }
}
