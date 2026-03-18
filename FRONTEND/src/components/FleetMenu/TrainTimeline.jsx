import { useState, useEffect } from 'react'

const TOTAL = 1440 // minuty w dobie

function tM(t) {
    if (!t) return null
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}

function useNowMins() {
    const [mins, setMins] = useState(() => {
        const d = new Date()
        return d.getHours() * 60 + d.getMinutes()
    })
    useEffect(() => {
        const id = setInterval(() => {
            const d = new Date()
            setMins(d.getHours() * 60 + d.getMinutes())
        }, 30000)
        return () => clearInterval(id)
    }, [])
    return mins
}

function buildSegments(rozklad) {
    const byKurs = {}
    rozklad.forEach(r => {
        if (!byKurs[r.kurs]) byKurs[r.kurs] = []
        byKurs[r.kurs].push(r)
    })

    const sortedCourses = Object.values(byKurs)
        .sort((a, b) => (tM(a[0].odjazd) ?? 0) - (tM(b[0].odjazd) ?? 0))

    // Zbierz aktywne przedziały (jazda + postój na stacji) z absolutnymi minutami
    const activeIntervals = []
    let prevEnd = 0

    sortedCourses.forEach(stops => {
        let curMins = null

        for (let i = 0; i < stops.length; i++) {
            const s = stops[i]

            if (i === 0) {
                let dep = tM(s.odjazd)
                if (dep === null) return
                // Korekta na przeskok przez północ względem poprzedniego kursu
                while (dep < prevEnd - 60) dep += TOTAL
                curMins = dep
            } else {
                let arr = tM(s.przyjazd)
                if (arr === null) break
                while (arr < curMins) arr += TOTAL

                // Jazda: curMins → arr
                activeIntervals.push({ start: curMins, end: arr, type: 'travel' })

                if (i < stops.length - 1 && s.odjazd) {
                    // Postój na stacji: arr → dep
                    let dep = tM(s.odjazd)
                    while (dep < arr) dep += TOTAL
                    if (dep > arr) {
                        activeIntervals.push({ start: arr, end: dep, type: 'station' })
                    }
                    curMins = dep
                } else {
                    curMins = arr
                }
            }
        }

        if (curMins !== null) prevEnd = curMins
    })

    activeIntervals.sort((a, b) => a.start - b.start)

    // Normalizacja: sprowadzamy wszystkie przedziały do zakresu 0–TOTAL
    const normalized = []
    for (const iv of activeIntervals) {
        const s = iv.start
        const e = iv.end
        if (s >= TOTAL) {
            // Cały przedział po północy – normalizuj modulo
            const ns = s % TOTAL
            const ne = e % TOTAL || TOTAL
            if (ne > ns) normalized.push({ start: ns, end: ne, type: iv.type })
            else {
                // Sam też przekracza północ – podziel
                normalized.push({ start: ns, end: TOTAL, type: iv.type })
                if (e % TOTAL > 0) normalized.push({ start: 0, end: e % TOTAL, type: iv.type })
            }
        } else if (e > TOTAL) {
            // Przekracza północ – podziel na część przed i po
            normalized.push({ start: s, end: TOTAL, type: iv.type })
            const wrapEnd = e % TOTAL
            if (wrapEnd > 0) normalized.push({ start: 0, end: wrapEnd, type: iv.type })
        } else {
            normalized.push({ ...iv })
        }
    }
    normalized.sort((a, b) => a.start - b.start)

    // Przerwa liniowa między dwoma sąsiednimi eventami (nie okrężna)
    function addGap(segs, gs, ge) {
        if (ge <= gs) return
        const gap = ge - gs
        if (gap <= 120) {
            segs.push({ start: gs, end: ge, type: 'near' })
        } else {
            segs.push({ start: gs,      end: gs + 60, type: 'near' })
            segs.push({ start: gs + 60, end: ge - 60, type: 'idle' })
            segs.push({ start: ge - 60, end: ge,      type: 'near' })
        }
    }

    if (normalized.length === 0) {
        return [{ start: 0, end: TOTAL, type: 'idle' }]
    }

    const firstStart = normalized[0].start
    const segments = []

    // Przetwarzaj przerwy MIĘDZY kursami (wewnętrzne, nie okrężne)
    // Zaczynamy od firstStart, pomijając lukę okrężną [lastEnd→firstStart]
    let pos = firstStart

    for (const iv of normalized) {
        if (iv.start > pos) addGap(segments, pos, iv.start)
        segments.push({ ...iv })
        pos = iv.end
    }

    // Okrężna luka między końcem ostatniego kursu a początkiem pierwszego
    // (owijając przez północ): lastEnd → firstStart
    const lastEnd = pos
    const circGap = lastEnd <= firstStart
        ? firstStart - lastEnd            // nie owija przez północ (rzadkie)
        : (TOTAL - lastEnd) + firstStart  // owija przez północ

    if (circGap > 0) {
        if (circGap <= 120) {
            // Całość żółta
            if (lastEnd < TOTAL) segments.push({ start: lastEnd, end: TOTAL, type: 'near' })
            if (firstStart > 0)  segments.unshift({ start: 0, end: firstStart, type: 'near' })
        } else {
            // Żółty 60 min po ostatnim evencie
            const trailEnd = lastEnd + 60
            if (trailEnd <= TOTAL) {
                segments.push({ start: lastEnd, end: trailEnd,  type: 'near' })
                segments.push({ start: trailEnd, end: TOTAL,    type: 'idle' })
            } else {
                // Żółty owija przez północ
                segments.push({ start: lastEnd, end: TOTAL, type: 'near' })
                const overflow = trailEnd % TOTAL
                segments.unshift({ start: 0, end: overflow, type: 'near' })
                // Czerwony od overflow do firstStart-60
                const leadStart = Math.max(overflow, firstStart - 60)
                if (leadStart > overflow) segments.unshift({ start: overflow, end: leadStart, type: 'idle' })
                if (firstStart > leadStart) segments.unshift({ start: leadStart, end: firstStart, type: 'near' })
                return segments.sort((a, b) => a.start - b.start)
            }

            // Żółty 60 min przed pierwszym eventem
            const leadStart = firstStart - 60
            if (leadStart >= 0) {
                segments.unshift({ start: leadStart, end: firstStart, type: 'near' })
                if (leadStart > 0) segments.unshift({ start: 0, end: leadStart, type: 'idle' })
            } else {
                // Pierwszy event jest < 60 min po północy
                segments.unshift({ start: 0, end: firstStart, type: 'near' })
                // Trailing idle do końca, near już dodany wyżej
            }
        }
    }

    return segments.sort((a, b) => a.start - b.start)
}

const COLORS = {
    travel:  '#4caf50',
    station: '#f0c040',
    near:    '#f0c040', // < 60 min od eventu → żółty
    idle:    '#c0392b', // ≥ 60 min od każdego eventu → czerwony
}

const STATUS_LABEL = {
    travel:  'Jedzie',
    station: 'Na stacji',
    near:    'Postój',
    idle:    'Postój',
}

export default function TrainTimeline({ rozklad }) {
    const nowMins = useNowMins()

    if (!rozklad || rozklad.length === 0) return null

    const segments = buildSegments(rozklad)

    // Aktualny status
    let currentType = 'idle'
    for (const seg of segments) {
        const start = seg.start % TOTAL
        const end = Math.min(seg.end, TOTAL)
        if (nowMins >= start && nowMins < end) {
            currentType = seg.type
            break
        }
    }

    const statusColor = COLORS[currentType]
    const nowPct = (nowMins / TOTAL) * 100

    return (
        <div style={{ padding: '6px 0 2px' }}>
            {/* Nagłówek z aktualnym statusem */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <span style={{ fontSize: '10px', color: '#8aab8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Oś czasu 24h
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: statusColor, letterSpacing: '0.5px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: `0 0 5px ${statusColor}` }} />
                    {STATUS_LABEL[currentType]}
                </span>
                <span style={{ fontSize: '10px', color: '#c0d0c0', marginLeft: 'auto' }}>
                    {String(Math.floor(nowMins / 60)).padStart(2, '0')}:{String(nowMins % 60).padStart(2, '0')}
                </span>
            </div>

            {/* Pasek osi czasu */}
            <div style={{ position: 'relative', height: '12px' }}>
                {/* Tło + kolorowe segmenty */}
                <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', borderRadius: '5px', overflow: 'hidden' }}>
                    {segments.map((seg, i) => {
                        const startPct = (Math.min(seg.start, TOTAL) / TOTAL) * 100
                        const endPct = (Math.min(seg.end, TOTAL) / TOTAL) * 100
                        const width = endPct - startPct
                        if (width <= 0) return null
                        return (
                            <div key={i} style={{
                                position: 'absolute',
                                left: `${startPct}%`,
                                width: `${width}%`,
                                height: '100%',
                                background: COLORS[seg.type],
                                opacity: 0.85,
                            }} />
                        )
                    })}
                    {/* Podziałka co 30 min (48 kresek) */}
                    {Array.from({ length: 47 }, (_, i) => i + 1).map(half => (
                        <div key={half} style={{
                            position: 'absolute',
                            left: `${(half / 48) * 100}%`,
                            top: 0,
                            width: '1px',
                            height: half % 2 === 0 ? '70%' : '40%',
                            background: 'rgba(0,0,0,0.5)',
                            pointerEvents: 'none',
                        }} />
                    ))}
                </div>
                {/* Igła aktualnej godziny */}
                <div style={{
                    position: 'absolute',
                    left: `${nowPct}%`,
                    top: '-2px',
                    transform: 'translateX(-50%)',
                    width: '2px',
                    height: '16px',
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: '1px',
                    pointerEvents: 'none',
                    zIndex: 2,
                    boxShadow: '0 0 4px rgba(255,255,255,0.6)',
                }} />
            </div>

            {/* Etykiety co godzinę */}
            <div style={{ position: 'relative', height: '12px', marginTop: '1px' }}>
                {Array.from({ length: 25 }, (_, h) => (
                    <div key={h} style={{
                        position: 'absolute',
                        left: `${(h / 24) * 100}%`,
                        transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1px',
                    }}>
                        <div style={{ width: '1px', height: '4px', background: '#8aab8a' }} />
                        <span style={{ fontSize: '8px', color: '#8aab8a', lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {String(h % 24).padStart(2, '0')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
