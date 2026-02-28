import { useState, useMemo } from 'react'
import { calcDistancePrice, haversineKm } from '../../data/demand'
import styles from './PricingPanel.module.css'

// Klucz pary miast — zawsze w tej samej kolejności (mniejszy id pierwszy)
function pairKey(cityA, cityB) {
  return cityA.id < cityB.id
    ? `${cityA.id}--${cityB.id}`
    : `${cityB.id}--${cityA.id}`
}

/**
 * Props:
 *   trainSet      — obiekt składu
 *   routes        — wszystkie trasy
 *   cities        — wszystkie miasta
 *   customConfig  — własny cennik tego składu (null = używa globalnego)
 *   defaultConfig — globalny cennik gracza
 *   onSaveCustom(config)  — zapisz własny cennik dla składu
 *   onSaveDefault(config) — zapisz jako nowy globalny cennik
 *   onResetToDefault()    — usuń własny cennik (wróć do globalnego)
 *   onClose       — zamknij panel
 */
export default function PricingPanel({
  trainSet, routes, cities,
  customConfig, defaultConfig,
  onSaveCustom, onSaveDefault, onResetToDefault, onClose,
}) {
  // Tryb: czy skład ma własny cennik, czy używa globalnego
  const [isCustom, setIsCustom] = useState(customConfig != null)

  // Pola formularza — inicjalizujemy z własnego lub globalnego cennika
  const initConfig = customConfig ?? defaultConfig
  const [class1Per100km, setClass1] = useState(String(initConfig.class1Per100km ?? 10))
  const [class2Per100km, setClass2] = useState(String(initConfig.class2Per100km ?? 6))
  const [multipliers, setMultipliers] = useState(
    initConfig.multipliers?.length ? [...initConfig.multipliers] : [1.0, 0.9, 0.8, 0.7, 0.65, 0.6]
  )
  // Macierz nadpisań — tylko dla własnego cennika
  const [matrixOverrides, setMatrixOverrides] = useState(customConfig?.matrixOverrides ?? {})
  const [showClass, setShowClass] = useState(1)
  const [editingCell, setEditingCell] = useState(null)
  const [editingValue, setEditingValue] = useState('')

  const base1 = parseFloat(class1Per100km) || 0
  const base2 = parseFloat(class2Per100km) || 0
  const routesWithDist = routes.filter(r => r.distance > 0)

  function p1(dist) { return calcDistancePrice(dist, base1, multipliers) }
  function p2(dist) { return calcDistancePrice(dist, base2, multipliers) }

  // Przełącznik trybu
  function handleSwitchMode(toCustom) {
    if (toCustom === isCustom) return
    if (!toCustom) {
      // Przełącz na globalny — przywróć wartości z globalnego cennika
      setClass1(String(defaultConfig.class1Per100km ?? 10))
      setClass2(String(defaultConfig.class2Per100km ?? 6))
      setMultipliers(defaultConfig.multipliers?.length ? [...defaultConfig.multipliers] : [1.0, 0.9, 0.8, 0.7, 0.65, 0.6])
      setMatrixOverrides({})
    }
    // Przełącz na własny — zachowujemy aktualne wartości (wstępnie wypełnione globalnym)
    setIsCustom(toCustom)
    setEditingCell(null)
  }

  // ── Macierz ──────────────────────────────────────────────────
  function getCellPrice(cityA, cityB, cls) {
    const key = pairKey(cityA, cityB)
    const clsKey = cls === 1 ? 'class1' : 'class2'
    const ov = matrixOverrides[key]?.[clsKey]
    if (ov !== undefined) return ov
    const dist = Math.round(haversineKm(cityA.lat, cityA.lon, cityB.lat, cityB.lon))
    return cls === 1 ? p1(dist) : p2(dist)
  }

  function isOverridden(cityA, cityB) {
    const key = pairKey(cityA, cityB)
    const clsKey = showClass === 1 ? 'class1' : 'class2'
    return matrixOverrides[key]?.[clsKey] !== undefined
  }

  function startEdit(rowCityId, colCityId, currentValue) {
    setEditingCell(`${rowCityId}--${colCityId}`)
    setEditingValue(String(currentValue))
  }

  function commitEdit(cityA, cityB) {
    const key = pairKey(cityA, cityB)
    const numVal = parseFloat(editingValue)
    if (!isNaN(numVal) && numVal >= 0) {
      const clsKey = showClass === 1 ? 'class1' : 'class2'
      setMatrixOverrides(prev => ({
        ...prev,
        [key]: { ...(prev[key] ?? {}), [clsKey]: Math.round(numVal * 10) / 10 },
      }))
    }
    setEditingCell(null)
  }

  function clearOverride(e, cityA, cityB) {
    e.stopPropagation()
    const key = pairKey(cityA, cityB)
    const clsKey = showClass === 1 ? 'class1' : 'class2'
    setMatrixOverrides(prev => {
      const entry = { ...(prev[key] ?? {}) }
      delete entry[clsKey]
      if (Object.keys(entry).length === 0) {
        const { [key]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: entry }
    })
  }

  // Przystanki składu (z rozkładu lub przypisanych tras)
  const stopCities = useMemo(() => {
    const ids = new Set()
    const assigned = routes.filter(r => r.trainId === trainSet.id && r.distance > 0)
    if (trainSet.rozklad?.length > 0) {
      trainSet.rozklad.forEach(s => { if (s.miasto) ids.add(s.miasto) })
    } else {
      assigned.forEach(r => {
        if (r.from) ids.add(r.from)
        if (r.to) ids.add(r.to)
      })
    }
    return [...ids]
      .map(idOrName => cities.find(c => c.id === idOrName || c.name === idOrName))
      .filter(Boolean)
  }, [trainSet.rozklad, trainSet.id, routes, cities])

  // Obliczamy najdłuższy możliwy dystans między dowolną parą przystanków składu
  const maxRouteDist = useMemo(() => {
    let max = 0
    for (let i = 0; i < stopCities.length; i++) {
      for (let j = i + 1; j < stopCities.length; j++) {
        const d = haversineKm(stopCities[i].lat, stopCities[i].lon, stopCities[j].lat, stopCities[j].lon)
        if (d > max) max = d
      }
    }
    return Math.round(max)
  }, [stopCities])

  // Wymagany rozmiar tablicy mnożników dla tego składu (np. 340km wymaga 4 przedziałów)
  const requiredMultipliersCount = isCustom ? Math.max(1, Math.ceil(maxRouteDist / 100)) : multipliers.length

  const overrideCount = Object.values(matrixOverrides).filter(
    o => (showClass === 1 ? o.class1 : o.class2) !== undefined
  ).length

  function updateMultiplier(i, val) {
    const updated = [...multipliers]
    updated[i] = parseFloat(val) || 0
    setMultipliers(updated)
  }

  function addBracket() {
    const last = multipliers[multipliers.length - 1] ?? 0.5
    setMultipliers([...multipliers, +Math.max(0.05, last - 0.05).toFixed(2)])
  }

  function removeBracket(i) {
    if (multipliers.length <= 1) return
    setMultipliers(multipliers.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    // Jeżeli tryb własny, obcinamy tablicę mnożników do faktycznie wymaganej długości
    const finalMultipliers = isCustom ? multipliers.slice(0, requiredMultipliersCount) : multipliers
    const baseConfig = { class1Per100km: base1, class2Per100km: base2, multipliers: finalMultipliers }

    if (isCustom) {
      // Generujemy routePrices dla każdej trasy przypisanej do tego składu z uwzględnieniem nadpisań macierzy
      const computedRoutePrices = {}
      const assignedRoutes = routesWithDist.filter(r => r.trainId === trainSet.id)
      assignedRoutes.forEach(r => {
        const fromCity = cities.find(c => c.id === r.from)
        const toCity = cities.find(c => c.id === r.to)
        computedRoutePrices[r.id] = fromCity && toCity
          ? { class1: getCellPrice(fromCity, toCity, 1), class2: getCellPrice(fromCity, toCity, 2) }
          : { class1: p1(r.distance), class2: p2(r.distance) }
      })
      onSaveCustom({ ...baseConfig, matrixOverrides, routePrices: computedRoutePrices })
    } else {
      // Globalny — tylko parametry dystansowe, bez nadpisań per-trasa
      onSaveDefault(baseConfig)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Cennik — {trainSet.name}</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Przełącznik Globalny / Własny */}
      <div className={styles.modeSwitcher}>
        <button
          className={`${styles.modeBtn} ${!isCustom ? styles.modeActive : ''}`}
          onClick={() => handleSwitchMode(false)}
        >Globalny</button>
        <button
          className={`${styles.modeBtn} ${isCustom ? styles.modeActive : ''}`}
          onClick={() => handleSwitchMode(true)}
        >Własny dla składu</button>
      </div>

      {!isCustom && (
        <div className={styles.modeNote}>
          Zmiany wpłyną na wszystkie składy korzystające z cennika globalnego.
        </div>
      )}

      {/* Cena bazowa */}
      <div className={styles.baseRow}>
        <span className={styles.rowLabel}>Cena bazowa / 100 km:</span>
        <div className={styles.baseInputs}>
          <label className={styles.classField}>
            <span>Klasa 1</span>
            <input type="number" min="0" step="0.5" value={class1Per100km}
              onChange={e => setClass1(e.target.value)} />
            <span className={styles.unit}>PLN</span>
          </label>
          <label className={styles.classField}>
            <span>Klasa 2</span>
            <input type="number" min="0" step="0.5" value={class2Per100km}
              onChange={e => setClass2(e.target.value)} />
            <span className={styles.unit}>PLN</span>
          </label>
        </div>
      </div>

      {/* Mnożniki */}
      <div className={styles.multipliersSection}>
        <div className={styles.sectionLabel}>Mnożniki przedziałów (ceny łączne po prawej):</div>
        {multipliers.slice(0, requiredMultipliersCount).map((m, i) => (
          <div key={i} className={styles.multiplierRow}>
            <span className={styles.bracket}>{i * 100}–{(i + 1) * 100} km</span>
            <span className={styles.times}>×</span>
            <input
              type="number" min="0" max="5" step="0.05" value={m}
              onChange={e => updateMultiplier(i, e.target.value)}
              className={styles.multiplierInput}
            />
            <span className={styles.cumPrice}>
              → {p1((i + 1) * 100)} / {p2((i + 1) * 100)} PLN
            </span>
            {(!isCustom && multipliers.length > 1) && (
              <button className={styles.removeBtn} onClick={() => removeBracket(i)}>−</button>
            )}
          </div>
        ))}
        {!isCustom && (
          <button className={styles.addBracketBtn} onClick={addBracket}>+ Dodaj przedział</button>
        )}
        {isCustom && stopCities.length > 1 && (
          <div className={styles.hint} style={{ marginTop: '10px' }}>
            Skład obsługuje maksymalny dystans {maxRouteDist} km. Więcej przedziałów nie jest potrzebnych.
          </div>
        )}
      </div>

      {/* Macierz cen — tylko w trybie własnym */}
      {isCustom && (
        stopCities.length >= 2 ? (
          <div className={styles.matrixSection}>
            <div className={styles.matrixHeader}>
              <span className={styles.sectionLabel}>
                Macierz cen między przystankami
                {overrideCount > 0 && (
                  <span className={styles.overrideBadge}>{overrideCount} ręcznych</span>
                )}
              </span>
              <div className={styles.classSwitcher}>
                <button
                  className={`${styles.classBtn} ${showClass === 1 ? styles.classActive : ''}`}
                  onClick={() => setShowClass(1)}
                >Klasa 1</button>
                <button
                  className={`${styles.classBtn} ${showClass === 2 ? styles.classActive : ''}`}
                  onClick={() => setShowClass(2)}
                >Klasa 2</button>
              </div>
            </div>

            <div className={styles.matrixScroll}>
              <table className={styles.matrix}>
                <thead>
                  <tr>
                    <th className={styles.matrixCorner}></th>
                    {stopCities.map(c => (
                      <th key={c.id} className={styles.matrixColHdr}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stopCities.map(rowCity => (
                    <tr key={rowCity.id}>
                      <td className={styles.matrixRowHdr}>{rowCity.name}</td>
                      {stopCities.map(colCity => {
                        if (rowCity.id === colCity.id) {
                          return <td key={colCity.id} className={styles.matrixDiag}>—</td>
                        }
                        const dist = Math.round(haversineKm(rowCity.lat, rowCity.lon, colCity.lat, colCity.lon))
                        const price = getCellPrice(rowCity, colCity, showClass)
                        const overridden = isOverridden(rowCity, colCity)
                        const editing = editingCell === `${rowCity.id}--${colCity.id}`

                        return (
                          <td
                            key={colCity.id}
                            className={`${styles.matrixPrice} ${overridden ? styles.matrixOverridden : ''}`}
                            onClick={() => !editing && startEdit(rowCity.id, colCity.id, price)}
                          >
                            {editing ? (
                              <input
                                className={styles.cellInput}
                                autoFocus
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onBlur={() => commitEdit(rowCity, colCity)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitEdit(rowCity, colCity)
                                  if (e.key === 'Escape') setEditingCell(null)
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <span className={styles.priceVal}>{price}</span>
                                <span className={styles.distHint}>{dist} km</span>
                                {overridden && (
                                  <button
                                    className={styles.clearBtn}
                                    onClick={e => clearOverride(e, rowCity, colCity)}
                                    title="Przywróć cenę wyliczoną"
                                  >×</button>
                                )}
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.matrixHint}>
              Kliknij komórkę aby zmienić cenę. × przywraca cenę dystansową.
            </div>
          </div>
        ) : (
          <div className={styles.emptyNote}>
            Brak przypisanych tras — macierz dostępna po przypisaniu składu do trasy.
          </div>
        )
      )}

      <div className={styles.panelFooter}>
        <span className={styles.hint}>
          {isCustom
            ? `Własny cennik dla składu${routesWithDist.length > 0 ? ` (${routesWithDist.length} tras)` : ''}.`
            : 'Cennik globalny — wspólny dla wszystkich składów bez własnego.'}
        </span>
        <div className={styles.footerBtns}>
          {customConfig != null && (
            <button className={styles.resetBtn} onClick={onResetToDefault}>
              Przywróć globalny
            </button>
          )}
          <button className={styles.saveBtn} onClick={handleSave}>
            {isCustom ? 'Zapisz cennik składu' : 'Zapisz cennik globalny'}
          </button>
        </div>
      </div>
    </div>
  )
}
