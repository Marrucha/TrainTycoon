export const INITIAL_BUDGET = 250_000_000

export const TRAINS = [
  { id: 't1', name: 'IC 1001', type: 'InterCity', speed: 160, seats: 300, costPerKm: 12 },
  { id: 't2', name: 'IC 1002', type: 'InterCity', speed: 160, seats: 300, costPerKm: 12 },
  { id: 't3', name: 'TLK 4001', type: 'TLK', speed: 120, seats: 420, costPerKm: 8 },
  { id: 't4', name: 'EIC 301', type: 'EIC', speed: 200, seats: 250, costPerKm: 18 },
]

// travelTime w minutach
export const INITIAL_ROUTES = [
  // ── TIER-1: Aktywne (demonstracyjne) ─────────────────────────────────────
  {
    id: 'warszawa-ciechanow-t1',
    from: 'warszawa', to: 'ciechanow',
    routeTier: 1,
    trainId: 't4', departures: ['07:00', '12:00', '17:00'],
    distance: 85, travelTime: 55, ticketPrice: 35, avgOccupancy: 0.85, dailyRevenue: 7200, subsidy: 1800,
  },
  { id: 'ciechanow-ilawa', from: 'ciechanow', to: 'ilawa', routeTier: 1, trainId: null, departures: [], distance: 105, travelTime: 55, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ilawa-tczew', from: 'ilawa', to: 'tczew', routeTier: 1, trainId: null, departures: [], distance: 80, travelTime: 45, ticketPrice: 33, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ilawa-olsztyn', from: 'ilawa', to: 'olsztyn', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ilawa-grudziadz', from: 'ilawa', to: 'grudziadz', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 38, ticketPrice: 21, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  {
    id: 'warszawa-skierniewice',
    from: 'warszawa', to: 'skierniewice',
    routeTier: 1,
    trainId: 't3', departures: ['05:45', '08:30', '12:00', '15:30', '19:00'],
    distance: 85, travelTime: 48, ticketPrice: 32, avgOccupancy: 0.68, dailyRevenue: 2100, subsidy: 600,
  },
  { id: 'skierniewice-lodz', from: 'skierniewice', to: 'lodz', routeTier: 1, trainId: null, departures: [], distance: 52, travelTime: 30, ticketPrice: 22, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  // ── TIER-1: Warszawa → Zawiercie → Kraków ────────────────────────────────
  { id: 'warszawa-zawiercie', from: 'warszawa', to: 'zawiercie', routeTier: 1, trainId: null, departures: [], distance: 260, travelTime: 120, ticketPrice: 89, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'zawiercie-krakow', from: 'zawiercie', to: 'krakow', routeTier: 1, trainId: null, departures: [], distance: 55, travelTime: 35, ticketPrice: 25, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-1: Zawiercie → Dąbrowa Górnicza → Sosnowiec → Katowice ──────────
  { id: 'zawiercie-dabrowa', from: 'zawiercie', to: 'dabrowa-gornicza', routeTier: 1, trainId: null, departures: [], distance: 25, travelTime: 20, ticketPrice: 12, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'dabrowa-sosnowiec', from: 'dabrowa-gornicza', to: 'sosnowiec', routeTier: 1, trainId: null, departures: [], distance: 10, travelTime: 10, ticketPrice: 5, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'sosnowiec-katowice', from: 'sosnowiec', to: 'katowice', routeTier: 1, trainId: null, departures: [], distance: 15, travelTime: 15, ticketPrice: 8, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-1: Rzeszów → Tarnów → Kraków → Jaworzno → Sosnowiec → Katowice ─
  { id: 'rzeszow-tarnow', from: 'rzeszow', to: 'tarnow', routeTier: 1, trainId: null, departures: [], distance: 100, travelTime: 65, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'tarnow-krakow-t1', from: 'tarnow', to: 'krakow', routeTier: 1, trainId: null, departures: [], distance: 80, travelTime: 55, ticketPrice: 32, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'krakow-jaworzno', from: 'krakow', to: 'jaworzno', routeTier: 1, trainId: null, departures: [], distance: 35, travelTime: 30, ticketPrice: 18, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'jaworzno-sosnowiec', from: 'jaworzno', to: 'sosnowiec', routeTier: 1, trainId: null, departures: [], distance: 15, travelTime: 15, ticketPrice: 8, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-1: … → Katowice → Gliwice → Opole → Wrocław ────────────────────
  { id: 'gliwice-katowice', from: 'gliwice', to: 'katowice', routeTier: 1, trainId: null, departures: [], distance: 30, travelTime: 25, ticketPrice: 12, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'gliwice-opole', from: 'gliwice', to: 'opole', routeTier: 1, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 22, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'wroclaw-opole', from: 'wroclaw', to: 'opole', routeTier: 1, trainId: null, departures: [], distance: 91, travelTime: 55, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-1: Łódź → Sieradz → Kalisz → Wrocław ───────────────────────────
  { id: 'lodz-sieradz', from: 'lodz', to: 'sieradz', routeTier: 1, trainId: null, departures: [], distance: 60, travelTime: 40, ticketPrice: 25, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'sieradz-kalisz', from: 'sieradz', to: 'kalisz', routeTier: 1, trainId: null, departures: [], distance: 40, travelTime: 28, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kalisz-ostrow-wlkp', from: 'kalisz', to: 'ostrow-wlkp', routeTier: 1, trainId: null, departures: [], distance: 30, travelTime: 22, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ostrow-wlkp-wroclaw', from: 'ostrow-wlkp', to: 'wroclaw', routeTier: 1, trainId: null, departures: [], distance: 105, travelTime: 70, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-1: Wrocław → Leszno → Poznań ────────────────────────────────────
  { id: 'wroclaw-leszno', from: 'wroclaw', to: 'leszno', routeTier: 1, trainId: null, departures: [], distance: 70, travelTime: 45, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'leszno-poznan', from: 'leszno', to: 'poznan', routeTier: 1, trainId: null, departures: [], distance: 75, travelTime: 45, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-1: Poznań → Gorzów → Szczecin ───────────────────────────────────
  { id: 'poznan-gorzow', from: 'poznan', to: 'gorzow', routeTier: 1, trainId: null, departures: [], distance: 143, travelTime: 80, ticketPrice: 49, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'szczecin-gorzow', from: 'szczecin', to: 'gorzow', routeTier: 1, trainId: null, departures: [], distance: 139, travelTime: 80, ticketPrice: 49, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-1: Łódź → Piotrków → Kielce ─────────────────────────────────────
  { id: 'lodz-piotrkow', from: 'lodz', to: 'piotrkow-trybunalski', routeTier: 1, trainId: null, departures: [], distance: 50, travelTime: 35, ticketPrice: 20, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'piotrkow-kielce', from: 'piotrkow-trybunalski', to: 'kielce', routeTier: 1, trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 35, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'piotrkow-tomaszow', from: 'piotrkow-trybunalski', to: 'tomaszow-maz', routeTier: 2, trainId: null, departures: [], distance: 25, travelTime: 18, ticketPrice: 11, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-1: Warszawa → Lublin / Białystok / Poznań ───────────────────────
  { id: 'warszawa-pulawy', from: 'warszawa', to: 'pulawy', routeTier: 1, trainId: null, departures: [], distance: 120, travelTime: 68, ticketPrice: 45, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'pulawy-lublin', from: 'pulawy', to: 'lublin', routeTier: 1, trainId: null, departures: [], distance: 50, travelTime: 32, ticketPrice: 21, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'warszawa-bialystok', from: 'warszawa', to: 'bialystok', routeTier: 1, trainId: null, departures: [], distance: 189, travelTime: 105, ticketPrice: 65, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'warszawa-kutno', from: 'warszawa', to: 'kutno', routeTier: 1, trainId: null, departures: [], distance: 120, travelTime: 65, ticketPrice: 45, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kutno-konin', from: 'kutno', to: 'konin', routeTier: 1, trainId: null, departures: [], distance: 75, travelTime: 48, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kutno-lodz', from: 'kutno', to: 'lodz', routeTier: 2, trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 35, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'konin-poznan', from: 'konin', to: 'poznan', routeTier: 1, trainId: null, departures: [], distance: 120, travelTime: 60, ticketPrice: 45, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Trójmiasto i wybrzeże ─────────────────────────────────────────
  { id: 'gdynia-sopot', from: 'gdynia', to: 'sopot', routeTier: 2, trainId: null, departures: [], distance: 10, travelTime: 8, ticketPrice: 5, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'sopot-gdansk', from: 'sopot', to: 'gdansk', routeTier: 2, trainId: null, departures: [], distance: 12, travelTime: 10, ticketPrice: 6, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'gdynia-wladyslawowo', from: 'gdynia', to: 'wladyslawowo', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 38, ticketPrice: 21, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'wladyslawowo-hel', from: 'wladyslawowo', to: 'hel', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 25, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'gdynia-slupsk', from: 'gdynia', to: 'slupsk', routeTier: 2, trainId: null, departures: [], distance: 95, travelTime: 60, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'slupsk-koszalin', from: 'slupsk', to: 'koszalin', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 25, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kolobrzeg-koszalin', from: 'kolobrzeg', to: 'koszalin', routeTier: 2, trainId: null, departures: [], distance: 45, travelTime: 35, ticketPrice: 19, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'koszalin-szczecin', from: 'koszalin', to: 'szczecin', routeTier: 2, trainId: null, departures: [], distance: 155, travelTime: 95, ticketPrice: 55, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'szczecin-swinoujscie', from: 'szczecin', to: 'swinoujscie', routeTier: 2, trainId: null, departures: [], distance: 100, travelTime: 70, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'elblag-gdansk', from: 'elblag', to: 'gdansk', routeTier: 2, trainId: null, departures: [], distance: 60, travelTime: 45, ticketPrice: 25, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'tczew-elblag', from: 'tczew', to: 'elblag', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 38, ticketPrice: 21, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'elblag-olsztyn', from: 'elblag', to: 'olsztyn', routeTier: 2, trainId: null, departures: [], distance: 75, travelTime: 50, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Kujawsko-Pomorskie ────────────────────────────────────────────
  { id: 'grudziadz-bydgoszcz', from: 'grudziadz', to: 'bydgoszcz', routeTier: 1, trainId: null, departures: [], distance: 45, travelTime: 35, ticketPrice: 19, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'grudziadz-torun', from: 'grudziadz', to: 'torun', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 30, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'gdansk-tczew', from: 'gdansk', to: 'tczew', routeTier: 1, trainId: null, departures: [], distance: 35, travelTime: 25, ticketPrice: 15, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'tczew-grudziadz', from: 'tczew', to: 'grudziadz', routeTier: 1, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'bydgoszcz-torun', from: 'bydgoszcz', to: 'torun', routeTier: 2, trainId: null, departures: [], distance: 47, travelTime: 30, ticketPrice: 19, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'wloclawek-torun', from: 'wloclawek', to: 'torun', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 22, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'wloclawek-plock', from: 'wloclawek', to: 'plock', routeTier: 2, trainId: null, departures: [], distance: 70, travelTime: 50, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'plock-warszawa', from: 'plock', to: 'warszawa', routeTier: 2, trainId: null, departures: [], distance: 115, travelTime: 75, ticketPrice: 45, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'plock-ciechanow', from: 'plock', to: 'ciechanow', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 50, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ciechanow-ostroleka', from: 'ciechanow', to: 'ostroleka', routeTier: 2, trainId: null, departures: [], distance: 75, travelTime: 55, ticketPrice: 31, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Mazowsze i Podlaskie ──────────────────────────────────────────
  { id: 'radom-warszawa', from: 'radom', to: 'warszawa', routeTier: 2, trainId: null, departures: [], distance: 100, travelTime: 65, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'radom-skarzysko', from: 'radom', to: 'skarzysko', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 28, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'skarzysko-kielce', from: 'skarzysko', to: 'kielce', routeTier: 2, trainId: null, departures: [], distance: 35, travelTime: 25, ticketPrice: 15, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'radom-ostrowiec', from: 'radom', to: 'ostrowiec-sw', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 45, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'radom-pulawy', from: 'radom', to: 'pulawy', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 38, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'siedlce-warszawa', from: 'siedlce', to: 'warszawa', routeTier: 2, trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 35, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'lukow-biala-podlaska', from: 'lukow', to: 'biala-podlaska', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 38, ticketPrice: 21, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'warszawa-ostroleka', from: 'warszawa', to: 'ostroleka', routeTier: 2, trainId: null, departures: [], distance: 95, travelTime: 65, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  // Warszawa → Ciechanów → Olsztyn (zamiast bezpośredniego)
  { id: 'ciechanow-olsztyn', from: 'ciechanow', to: 'olsztyn', routeTier: 2, trainId: null, departures: [], distance: 140, travelTime: 80, ticketPrice: 49, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Warmińsko-Mazurskie / Ełk / Suwałki ───────────────────────────
  { id: 'bialystok-elk', from: 'bialystok', to: 'elk', routeTier: 2, trainId: null, departures: [], distance: 150, travelTime: 100, ticketPrice: 55, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'elk-suwalki', from: 'elk', to: 'suwalki', routeTier: 2, trainId: null, departures: [], distance: 75, travelTime: 50, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'elk-gizycko', from: 'elk', to: 'gizycko', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 38, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ostroleka-elk', from: 'ostroleka', to: 'elk', routeTier: 2, trainId: null, departures: [], distance: 130, travelTime: 90, ticketPrice: 49, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  // Ostrołęka → Łomża → Białystok (zamiast bezpośredniego)
  { id: 'ostroleka-lomza', from: 'ostroleka', to: 'lomza', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 35, ticketPrice: 22, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'lomza-bialystok', from: 'lomza', to: 'bialystok', routeTier: 2, trainId: null, departures: [], distance: 110, travelTime: 70, ticketPrice: 42, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Lubelskie ─────────────────────────────────────────────────────
  { id: 'lublin-chelm', from: 'lublin', to: 'chelm', routeTier: 2, trainId: null, departures: [], distance: 70, travelTime: 50, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'lublin-zamosc', from: 'lublin', to: 'zamosc', routeTier: 2, trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 35, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'lublin-ostrowiec', from: 'lublin', to: 'ostrowiec-sw', routeTier: 2, trainId: null, departures: [], distance: 95, travelTime: 58, ticketPrice: 37, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'lublin-stalowa-wola', from: 'lublin', to: 'stalowa-wola', routeTier: 1, trainId: null, departures: [], distance: 120, travelTime: 68, ticketPrice: 45, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'lublin-lukow', from: 'lublin', to: 'lukow', routeTier: 2, trainId: null, departures: [], distance: 70, travelTime: 48, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'lukow-siedlce', from: 'lukow', to: 'siedlce', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 22, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'siedlce-bialystok', from: 'siedlce', to: 'bialystok', routeTier: 2, trainId: null, departures: [], distance: 120, travelTime: 80, ticketPrice: 45, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Podkarpacie ───────────────────────────────────────────────────
  { id: 'rzeszow-przemysl', from: 'rzeszow', to: 'przemysl', routeTier: 2, trainId: null, departures: [], distance: 75, travelTime: 50, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'rzeszow-krosno', from: 'rzeszow', to: 'krosno', routeTier: 2, trainId: null, departures: [], distance: 60, travelTime: 45, ticketPrice: 25, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'tarnobrzeg-stalowa-wola', from: 'tarnobrzeg', to: 'stalowa-wola', routeTier: 2, trainId: null, departures: [], distance: 20, travelTime: 15, ticketPrice: 9, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'stalowa-wola-rzeszow', from: 'stalowa-wola', to: 'rzeszow', routeTier: 1, trainId: null, departures: [], distance: 55, travelTime: 38, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'stalowa-wola-zamosc', from: 'stalowa-wola', to: 'zamosc', routeTier: 2, trainId: null, departures: [], distance: 80, travelTime: 55, ticketPrice: 33, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'tarnobrzeg-ostrowiec', from: 'tarnobrzeg', to: 'ostrowiec-sw', routeTier: 2, trainId: null, departures: [], distance: 45, travelTime: 32, ticketPrice: 19, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ostrowiec-kielce', from: 'ostrowiec-sw', to: 'kielce', routeTier: 2, trainId: null, departures: [], distance: 45, travelTime: 32, ticketPrice: 19, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Małopolska ────────────────────────────────────────────────────
  { id: 'nowy-sacz-tarnow', from: 'nowy-sacz', to: 'tarnow', routeTier: 2, trainId: null, departures: [], distance: 70, travelTime: 50, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'nowy-sacz-krynica', from: 'nowy-sacz', to: 'krynica-gorska', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 30, ticketPrice: 14, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'krakow-rabka', from: 'krakow', to: 'rabka-zdroj', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 45, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'rabka-zakopane', from: 'rabka-zdroj', to: 'zakopane', routeTier: 2, trainId: null, departures: [], distance: 35, travelTime: 28, ticketPrice: 15, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'krakow-miechow', from: 'krakow', to: 'miechow', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 30, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'miechow-kielce', from: 'miechow', to: 'kielce', routeTier: 2, trainId: null, departures: [], distance: 75, travelTime: 50, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Łódź — dodatkowe ──────────────────────────────────────────────
  { id: 'czestochowa-zawiercie', from: 'czestochowa', to: 'zawiercie', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 35, ticketPrice: 22, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'czestochowa-opole', from: 'czestochowa', to: 'opole', routeTier: 2, trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 35, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'czestochowa-kielce', from: 'czestochowa', to: 'kielce', routeTier: 2, trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 35, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'czestochowa-radomsko', from: 'czestochowa', to: 'radomsko', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 38, ticketPrice: 22, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'piotrkow-belchatow', from: 'piotrkow-trybunalski', to: 'belchatow', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 30, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'radomsko-piotrkow', from: 'radomsko', to: 'piotrkow-trybunalski', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 30, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'belchatow-sieradz', from: 'belchatow', to: 'sieradz', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 35, ticketPrice: 22, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Wielkopolska / Piła ───────────────────────────────────────────
  { id: 'poznan-pila', from: 'poznan', to: 'pila', routeTier: 2, trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 35, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'pila-bydgoszcz', from: 'pila', to: 'bydgoszcz', routeTier: 2, trainId: null, departures: [], distance: 80, travelTime: 55, ticketPrice: 32, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'pila-szczecinek', from: 'pila', to: 'szczecinek', routeTier: 2, trainId: null, departures: [], distance: 75, travelTime: 50, ticketPrice: 31, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'szczecinek-koszalin', from: 'szczecinek', to: 'koszalin', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 45, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'pila-stargard', from: 'pila', to: 'stargard', routeTier: 2, trainId: null, departures: [], distance: 100, travelTime: 65, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'stargard-szczecin', from: 'stargard', to: 'szczecin', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 22, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'stargard-szczecinek', from: 'stargard', to: 'szczecinek', routeTier: 2, trainId: null, departures: [], distance: 80, travelTime: 55, ticketPrice: 33, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kalisz-poznan', from: 'kalisz', to: 'poznan', routeTier: 2, trainId: null, departures: [], distance: 125, travelTime: 80, ticketPrice: 45, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'poznan-gniezno', from: 'poznan', to: 'gniezno', routeTier: 1, trainId: null, departures: [], distance: 50, travelTime: 32, ticketPrice: 21, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'gniezno-inowroclaw', from: 'gniezno', to: 'inowroclaw', routeTier: 1, trainId: null, departures: [], distance: 40, travelTime: 28, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'inowroclaw-bydgoszcz', from: 'inowroclaw', to: 'bydgoszcz', routeTier: 1, trainId: null, departures: [], distance: 40, travelTime: 28, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'inowroclaw-torun', from: 'inowroclaw', to: 'torun', routeTier: 2, trainId: null, departures: [], distance: 35, travelTime: 25, ticketPrice: 15, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'inowroclaw-wloclawek', from: 'inowroclaw', to: 'wloclawek', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 28, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'konin-gniezno', from: 'konin', to: 'gniezno', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 38, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'konin-kalisz', from: 'konin', to: 'kalisz', routeTier: 2, trainId: null, departures: [], distance: 70, travelTime: 48, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'konin-wloclawek', from: 'konin', to: 'wloclawek', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 45, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'tomaszow-radom', from: 'tomaszow-maz', to: 'radom', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 45, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'tomaszow-skierniewice', from: 'tomaszow-maz', to: 'skierniewice', routeTier: 2, trainId: null, departures: [], distance: 45, travelTime: 32, ticketPrice: 19, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kutno-plock', from: 'kutno', to: 'plock', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'mielec-tarnobrzeg', from: 'mielec', to: 'tarnobrzeg', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 22, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'mielec-rzeszow', from: 'mielec', to: 'rzeszow', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 38, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'mielec-tarnow', from: 'mielec', to: 'tarnow', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 45, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'poznan-zielona-gora', from: 'poznan', to: 'zielona-gora', routeTier: 2, trainId: null, departures: [], distance: 141, travelTime: 80, ticketPrice: 49, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'zielona-gora-gorzow', from: 'zielona-gora', to: 'gorzow', routeTier: 2, trainId: null, departures: [], distance: 85, travelTime: 55, ticketPrice: 35, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Śląsk ────────────────────────────────────────────────────────
  // Alternatywna trasa Katowice → Chorzów → Bytom → Zabrze → Gliwice
  { id: 'chorzow-katowice', from: 'chorzow', to: 'katowice', routeTier: 2, trainId: null, departures: [], distance: 10, travelTime: 10, ticketPrice: 5, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'chorzow-bytom', from: 'chorzow', to: 'bytom', routeTier: 2, trainId: null, departures: [], distance: 8, travelTime: 10, ticketPrice: 5, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'bytom-zabrze', from: 'bytom', to: 'zabrze', routeTier: 2, trainId: null, departures: [], distance: 10, travelTime: 10, ticketPrice: 5, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'zabrze-gliwice', from: 'zabrze', to: 'gliwice', routeTier: 2, trainId: null, departures: [], distance: 15, travelTime: 15, ticketPrice: 8, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'tychy-katowice', from: 'tychy', to: 'katowice', routeTier: 2, trainId: null, departures: [], distance: 25, travelTime: 20, ticketPrice: 10, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'rybnik-gliwice', from: 'rybnik', to: 'gliwice', routeTier: 2, trainId: null, departures: [], distance: 35, travelTime: 30, ticketPrice: 15, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'jastrzebie-rybnik', from: 'jastrzebie-zdroj', to: 'rybnik', routeTier: 2, trainId: null, departures: [], distance: 15, travelTime: 15, ticketPrice: 8, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'rybnik-tychy', from: 'rybnik', to: 'tychy', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 25, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'jastrzebie-wisla', from: 'jastrzebie-zdroj', to: 'wisla', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 25, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'rybnik-raciborz', from: 'rybnik', to: 'raciborz', routeTier: 2, trainId: null, departures: [], distance: 25, travelTime: 20, ticketPrice: 11, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'gliwice-kedzierzyn', from: 'gliwice', to: 'kedzierzyn', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 30, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'raciborz-kedzierzyn', from: 'raciborz', to: 'kedzierzyn', routeTier: 2, trainId: null, departures: [], distance: 25, travelTime: 20, ticketPrice: 11, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kedzierzyn-nysa', from: 'kedzierzyn', to: 'nysa', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 30, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  // Bielsko-Biała → Tychy → Katowice (zamiast bezpośredniego)
  { id: 'bielsko-tychy', from: 'bielsko-biala', to: 'tychy', routeTier: 2, trainId: null, departures: [], distance: 35, travelTime: 28, ticketPrice: 15, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'bielsko-krakow', from: 'bielsko-biala', to: 'krakow', routeTier: 2, trainId: null, departures: [], distance: 100, travelTime: 65, ticketPrice: 39, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── TIER-2: Dolnośląskie ──────────────────────────────────────────────────
  { id: 'legnica-wroclaw', from: 'legnica', to: 'wroclaw', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 45, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'walbrych-wroclaw', from: 'walbrych', to: 'wroclaw', routeTier: 2, trainId: null, departures: [], distance: 75, travelTime: 55, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'jelenia-gora-walbrych', from: 'jelenia-gora', to: 'walbrych', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 22, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'walbrych-klodzko', from: 'walbrych', to: 'klodzko', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'opole-nysa', from: 'opole', to: 'nysa', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 45, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'nysa-klodzko', from: 'nysa', to: 'klodzko', routeTier: 2, trainId: null, departures: [], distance: 40, travelTime: 30, ticketPrice: 17, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'legnica-jelenia-gora', from: 'legnica', to: 'jelenia-gora', routeTier: 2, trainId: null, departures: [], distance: 60, travelTime: 45, ticketPrice: 25, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'jelenia-szklarska', from: 'jelenia-gora', to: 'szklarska-poreba', routeTier: 2, trainId: null, departures: [], distance: 25, travelTime: 20, ticketPrice: 11, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'legnica-lubin', from: 'legnica', to: 'lubin', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 22, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'lubin-glogow', from: 'lubin', to: 'glogow', routeTier: 2, trainId: null, departures: [], distance: 35, travelTime: 25, ticketPrice: 15, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'glogow-zielona-gora', from: 'glogow', to: 'zielona-gora', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'glogow-leszno', from: 'glogow', to: 'leszno', routeTier: 2, trainId: null, departures: [], distance: 70, travelTime: 50, ticketPrice: 29, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'zagan-legnica', from: 'zagan', to: 'legnica', routeTier: 2, trainId: null, departures: [], distance: 80, travelTime: 55, ticketPrice: 33, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'zagan-zielona-gora', from: 'zagan', to: 'zielona-gora', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 38, ticketPrice: 21, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'grudziadz-szczecinek', from: 'grudziadz', to: 'szczecinek', routeTier: 2, trainId: null, departures: [], distance: 120, travelTime: 80, ticketPrice: 45, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'krosno-sanok', from: 'krosno', to: 'sanok', routeTier: 2, trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 23, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── INTERNATIONAL: Polska → Niemcy ───────────────────────────────────────────
  { id: 'legnica-zgorzelec', from: 'legnica', to: 'zgorzelec', routeTier: 2, trainId: null, departures: [], distance: 110, travelTime: 70, ticketPrice: 42, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'zgorzelec-dresden', from: 'zgorzelec', to: 'dresden', routeTier: 'international', trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'poznan-slubice', from: 'poznan', to: 'slubice', routeTier: 2, trainId: null, departures: [], distance: 95, travelTime: 65, ticketPrice: 38, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'slubice-berlin', from: 'slubice', to: 'berlin', routeTier: 'international', trainId: null, departures: [], distance: 90, travelTime: 60, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'szczecin-hamburg', from: 'szczecin', to: 'hamburg', routeTier: 'international', trainId: null, departures: [], distance: 230, travelTime: 150, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── INTERNATIONAL: Polska → Białoruś ─────────────────────────────────────────
  { id: 'biala-terespol', from: 'biala-podlaska', to: 'terespol', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 35, ticketPrice: 20, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'terespol-brzesc', from: 'terespol', to: 'brzesc', routeTier: 'international', trainId: null, departures: [], distance: 4, travelTime: 5, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'brzesc-minsk', from: 'brzesc', to: 'minsk', routeTier: 'international', trainId: null, departures: [], distance: 350, travelTime: 240, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── INTERNATIONAL: Polska → Litwa / Łotwa ────────────────────────────────────
  { id: 'suwalki-budzisko', from: 'suwalki', to: 'budzisko', routeTier: 2, trainId: null, departures: [], distance: 25, travelTime: 20, ticketPrice: 11, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'budzisko-vilnius', from: 'budzisko', to: 'vilnius', routeTier: 'international', trainId: null, departures: [], distance: 55, travelTime: 40, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'vilnius-riga', from: 'vilnius', to: 'riga', routeTier: 'international', trainId: null, departures: [], distance: 300, travelTime: 210, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── INTERNATIONAL: Polska → Ukraina ──────────────────────────────────────────
  { id: 'zamosc-hrebenne', from: 'zamosc', to: 'hrebenne', routeTier: 2, trainId: null, departures: [], distance: 65, travelTime: 48, ticketPrice: 27, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'hrebenne-lviv', from: 'hrebenne', to: 'lviv', routeTier: 'international', trainId: null, departures: [], distance: 80, travelTime: 55, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── INTERNATIONAL: Polska → Czechy / Słowacja / Węgry ────────────────────────
  { id: 'raciborz-chalupki', from: 'raciborz', to: 'chalupki', routeTier: 2, trainId: null, departures: [], distance: 22, travelTime: 18, ticketPrice: 10, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'chalupki-ostrava', from: 'chalupki', to: 'ostrava', routeTier: 'international', trainId: null, departures: [], distance: 15, travelTime: 12, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ostrava-prague', from: 'ostrava', to: 'prague', routeTier: 'international', trainId: null, departures: [], distance: 310, travelTime: 210, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ostrava-bratislava', from: 'ostrava', to: 'bratislava', routeTier: 'international', trainId: null, departures: [], distance: 260, travelTime: 180, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ostrava-vienna', from: 'ostrava', to: 'vienna', routeTier: 'international', trainId: null, departures: [], distance: 350, travelTime: 240, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'ostrava-budapest', from: 'ostrava', to: 'budapest', routeTier: 'international', trainId: null, departures: [], distance: 600, travelTime: 420, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── INTERNATIONAL: Polska → Słowacja (przez Barwinek / Przełęcz Dukielska) ──
  { id: 'krosno-barwinek', from: 'krosno', to: 'barwinek', routeTier: 2, trainId: null, departures: [], distance: 50, travelTime: 35, ticketPrice: 21, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'barwinek-kosice', from: 'barwinek', to: 'kosice', routeTier: 'international', trainId: null, departures: [], distance: 150, travelTime: 110, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kosice-budapest', from: 'kosice', to: 'budapest', routeTier: 'international', trainId: null, departures: [], distance: 290, travelTime: 200, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },

  // ── INTERNATIONAL: Polska → Czechy (przez Kudowę-Zdrój) ──────────────────────
  { id: 'klodzko-kudowa', from: 'klodzko', to: 'kudowa-zdroj', routeTier: 2, trainId: null, departures: [], distance: 30, travelTime: 25, ticketPrice: 13, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
  { id: 'kudowa-prague', from: 'kudowa-zdroj', to: 'prague', routeTier: 'international', trainId: null, departures: [], distance: 120, travelTime: 85, ticketPrice: 0, avgOccupancy: 0, dailyRevenue: 0, subsidy: 0 },
]
