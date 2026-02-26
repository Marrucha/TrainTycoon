// Współczynnik grawitacji — kalibracja: ~5 700 pasażerów/dzień dla Warszawa↔Kraków
const K = 5

// Wykładnik tłumienia dystansu — mniejszy niż 2 spłaszcza różnicę między krótkimi
// a długimi trasami, zapobiegając eksplozji liczb dla miast bliskich geograficznie
const DIST_EXP = 1.3

// Kraje UE obecne w grze
const EU_COUNTRIES = new Set([
  'Niemcy', 'Czechy', 'Austria', 'Słowacja', 'Litwa', 'Łotwa', 'Węgry',
])

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Efektywna populacja = mieszkańcy miasta + otoczenie (okoliczne miejscowości)
// Formuła otoczenia: pop^(2/3) × 27
export function hinterland(pop) {
  return Math.round(Math.pow(pop, 2 / 3) * 27)
}

function effectivePop(city) {
  const pop = city.population ?? 0
  return pop + hinterland(pop)
}

// Bonus stolicy kraju — aktywny dla wszystkich tras krajowych
function capitalBonus(city) {
  return city.isCapital ? 1.2 : 1.0
}

// Bonus stolicy województwa — aktywny TYLKO gdy oba miasta są w tym samym województwie
function voivodeshipBonus(city) {
  return city.tier === 1 && !city.isCapital ? 1.1 : 1.0
}

/**
 * Oblicza cenę biletu metodą kumulatywną z mnożnikami na przedziały 100 km.
 *
 * Przykład: basePer100km=10, multipliers=[1.0, 0.9, 0.7]
 *   80 km  → 80 × 0.10 × 1.0           = 8.0 PLN
 *   150 km → 100×0.10×1.0 + 50×0.10×0.9 = 14.5 PLN
 *   300 km → 10 + 9 + 7                  = 26.0 PLN
 *
 * Dla tras dłuższych niż zdefiniowane przedziały stosuje ostatni mnożnik.
 */
export function calcDistancePrice(distanceKm, basePer100km, multipliers) {
  if (!multipliers?.length || !basePer100km) return 0
  let price = 0
  let remaining = distanceKm
  for (let i = 0; i < multipliers.length && remaining > 0; i++) {
    const km = Math.min(remaining, 100)
    price += (km / 100) * basePer100km * multipliers[i]
    remaining -= km
  }
  if (remaining > 0) {
    price += (remaining / 100) * basePer100km * multipliers[multipliers.length - 1]
  }
  return Math.round(price * 10) / 10  // 1 miejsce po przecinku
}

/**
 * Zwraca ID profilu godzinowego dla trasy cityA → cityB.
 * Porównuje SUROWĄ populację (bez otoczenia).
 *
 *   'maly-duzy'  — cityA co najmniej 2× mniejsze niż cityB  (szczyt poranny)
 *   'duzy-maly'  — cityA co najmniej 2× większe niż cityB   (szczyt popołudniowy)
 *   'podobne'    — różnica < 2×                              (dwa równe szczyty)
 */
export function getHourProfileId(cityA, cityB) {
  const popA = cityA.population ?? 0
  const popB = cityB.population ?? 0
  if (popA === 0 || popB === 0) return 'podobne'
  if (popA >= 2 * popB) return 'duzy-maly'
  if (popB >= 2 * popA) return 'maly-duzy'
  return 'podobne'
}

/**
 * Oblicza dzienny popyt pasażerski między dwoma miastami (model grawitacyjny).
 *
 * Populacja efektywna = pop_miasta + pop^(2/3) × 27  (otoczenie komunikacyjne)
 * Formuła bazowa: K × (effPopA[tys] × effPopB[tys]) / dystans^DIST_EXP
 *
 * Modyfikatory:
 *   Bonus stolicy kraju (×1.2)          — zawsze dla tras krajowych
 *   Bonus stolicy woj. (×1.1)           — tylko gdy oba miasta w tym samym województwie
 *   Kara za granicę woj. (×0.9)         — gdy różne województwa (bonus stolicy woj. nie obowiązuje)
 *   Kara za granicę kraju EU (×0.3)     — bez żadnych bonusów
 *   Kara za granicę kraju spoza UE (×0.15) — bez żadnych bonusów
 *
 * Zwraca 0 dla węzłów granicznych bez populacji (tier: 'crossing').
 */
export function getDemand(cityA, cityB) {
  if (cityA.tier === 'crossing' || cityB.tier === 'crossing') return 0  // pomijamy węzły graniczne bez statusu miasta

  const distance = haversineKm(cityA.lat, cityA.lon, cityB.lat, cityB.lon)
  if (distance < 1) return 0

  const baseDemand = K * (effectivePop(cityA) / 1000) * (effectivePop(cityB) / 1000) / Math.pow(distance, DIST_EXP)

  const countryA = cityA.country ?? 'Polska'
  const countryB = cityB.country ?? 'Polska'

  let multiplier

  if (countryA !== countryB) {
    // Granica państwowa — żadnych bonusów
    const foreignCountry = countryA !== 'Polska' ? countryA : countryB
    multiplier = EU_COUNTRIES.has(foreignCountry) ? 0.3 : 0.15

  } else {
    // Ten sam kraj — bonus stolicy zawsze aktywny
    const sameVoivodeship =
      cityA.voivodeship && cityB.voivodeship && cityA.voivodeship === cityB.voivodeship

    if (sameVoivodeship) {
      // To samo województwo — bonus stolicy + bonus stolicy województwa
      multiplier = capitalBonus(cityA) * capitalBonus(cityB)
                 * voivodeshipBonus(cityA) * voivodeshipBonus(cityB)
    } else {
      // Różne województwa — bonus stolicy tak, bonus stolicy woj. nie, kara ×0.9
      multiplier = capitalBonus(cityA) * capitalBonus(cityB) * 0.9
    }
  }

  return Math.round(baseDemand * multiplier)
}
