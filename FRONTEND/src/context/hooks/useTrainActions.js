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
   * Uruchamia konserwację jednego lub wielu wagonów.
   * Pobiera koszt z budżetu spółki (jeśli cost > 0).
   * Zapisuje czas rozpoczęcia, czas trwania oraz planowaną datę zakończenia w grze.
   */
  async function startMaintenance(trainIdOrIds, cost = 0, durationHours = 12) {
    const ids = Array.isArray(trainIdOrIds) ? trainIdOrIds : [trainIdOrIds]
    if (ids.length === 0) return false

    if (cost > 0 && budget < cost) {
      alert(`Niewystarczające środki na koncie! Koszt konserwacji: ${cost.toLocaleString()} PLN`)
      return false
    }

    try {
      const batch = writeBatch(db)
      const timeMultiplier = 30
      // 12 godzin gry przy x30 = 24 minuty realnego czasu (lub min 15s dla płynnej demonstracji / krótkich prac)
      const durationRealMs = Math.max(15000, Math.round((durationHours * 3600 * 1000) / timeMultiplier))
      const nowReal = Date.now()
      const finishGameMs = gameDate ? (gameDate.getTime() + durationHours * 3600 * 1000) : (nowReal + durationRealMs * timeMultiplier)

      ids.forEach(id => {
        const ref = doc(db, `players/${auth.currentUser.uid}/trains/${id}`)
        batch.update(ref, {
          maintenanceStartedAt: nowReal,
          maintenanceDurationMs: durationRealMs,
          maintenanceFinishGameMs: finishGameMs,
          maintenanceComplete: false,
          lastMaintenance: gameDate?.toISOString() ?? new Date().toISOString(),
        })
      })

      if (cost > 0) {
        const playerRef = doc(db, 'players', auth.currentUser.uid)
        batch.update(playerRef, {
          'finance.balance': budget - cost,
        })
      }

      await batch.commit()
      return true
    } catch (e) {
      console.error('Błąd podczas uruchamiania konserwacji:', e)
      return false
    }
  }

  /**
   * Finalizuje konserwację dla jednego lub wielu wagonów.
   * Ustawia condition = 1.0 (100% sprawności).
   */
  async function completeMaintenance(trainIdOrIds) {
    const ids = Array.isArray(trainIdOrIds) ? trainIdOrIds : [trainIdOrIds]
    if (ids.length === 0) return false

    try {
      const batch = writeBatch(db)
      ids.forEach(id => {
        const ref = doc(db, `players/${auth.currentUser.uid}/trains/${id}`)
        batch.update(ref, {
          condition: 1.0,
          maintenanceComplete: true,
          maintenanceStartedAt: null,
          maintenanceDurationMs: null,
          maintenanceFinishGameMs: null,
          lastMaintenance: gameDate?.toISOString() ?? new Date().toISOString(),
        })
      })
      await batch.commit()
      return true
    } catch (e) {
      console.error('Błąd podczas finalizacji konserwacji:', e)
      return false
    }
  }

  /** Legacy performMaintenance przekierowuje do startMaintenance */
  async function performMaintenance(trainId) {
    return startMaintenance(trainId, 0, 12)
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
