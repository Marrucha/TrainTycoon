import { useState } from 'react'
import styles from '../RoutePanel.module.css'

function addDelay(timeStr, minutes) {
  if (!timeStr || timeStr === '—' || !minutes) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function CourseSchedule({
  ts,
  coursesCount,
  firstStops,
  dailyDemand,
  dailyTransfer,
  byKurs,
  cities,
  openKurs,
  setOpenKurs,
  openTimetable,
  setOpenTimetable,
  kursRevenue,
  totalDailyRevenue,
  totalSeats,
  stopOrder
}) {
  const [open, setOpen] = useState(false)

  if (firstStops.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionLabelRow} style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
          <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>ROZKŁAD KURSÓW</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={styles.depCount}>{coursesCount} kursów / dobę</span>
            <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
          </div>
        </div>
        {open && <div className={styles.emptySchedule} style={{ marginTop: 10 }}>Brak rozkładu jazdy</div>}
      </section>
    )
  }

  let dayObC1 = 0, dayObC2 = 0;
  let dayTrC1 = 0, dayTrC2 = 0;
  let dayDmC1 = 0, dayDmC2 = 0;

  const totalOnBoard = ts.currentTransfer
    ? Object.values(ts.currentTransfer).reduce((s, d) => s + (d.totalOnBoard || 0), 0)
    : 0

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabelRow} style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionLabel} style={{ marginBottom: 0, borderBottom: 'none' }}>ROZKŁAD KURSÓW</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!open && totalOnBoard > 0 && (
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#e74c3c', fontWeight: 'bold' }}>
              {totalOnBoard} w pociągu
            </span>
          )}
          <span className={styles.depCount}>{coursesCount} kursów / dobę</span>
          <span style={{ color: '#6a8a6a', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
        </div>
      </div>
      {open && <div className={styles.stats} style={{ marginTop: 10 }}>
        <div style={{ paddingBottom: '6px', marginBottom: '6px', borderBottom: '1px solid #1a2a1a', display: 'flex', gap: '12px', color: '#888', fontSize: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e74c3c' }}></span>W TRAKCIE JAZDY</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0c040' }}></span>ZAKOŃCZYLI</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffffff' }}></span>OCZEKUJĄCY</span>
        </div>

        {firstStops.map((s) => {
          const kursDemandTotal = dailyDemand?.[s.kurs]?.total ?? null
          const currentKursObj = ts.currentTransfer?.[s.kurs]
          const isStarted = !!currentKursObj

          let displayVal = 0
          let isActual = false

          if (isStarted) {
            const transferred = dailyTransfer?.[s.kurs]?.total || 0
            const onBoard = currentKursObj?.totalOnBoard || 0
            displayVal = transferred + onBoard
            isActual = true
          } else if (kursDemandTotal != null) {
            displayVal = Math.min(kursDemandTotal, totalSeats)
            isActual = false
          }

          const isOpen = openKurs === s.kurs

          // OD breakdown dla listy
          const odDemand = dailyDemand?.[s.kurs]?.od ?? {}
          const odTransfer = dailyTransfer?.[s.kurs]?.od ?? {}
          const odOnBoard = currentKursObj?.onBoard ?? {}

          // Detect kurs direction — is the first stop at the start or end of routeStops?
          const kursStops = byKurs[s.kurs] || []
          const firstStopName = kursStops[0]?.miasto
          const routeArr = ts.routeStops || []
          const firstCityObj = cities?.find(c => c.name === firstStopName || c.id === firstStopName)
          const firstCityId = firstCityObj?.id
          // If the kurs starts from the LAST routeStop, it's a reverse direction kurs
          const isReverseKurs = routeArr.length > 0 && firstCityId === routeArr[routeArr.length - 1]

          const allOdKeys = [...new Set([...Object.keys(odDemand), ...Object.keys(odTransfer), ...Object.keys(odOnBoard)])]
          const odKeys = allOdKeys
            .sort((a, b) => {
              const [af, at_] = a.split(':')
              const [bf, bt] = b.split(':')
              const afi = stopOrder[af] ?? 999
              const ati = stopOrder[at_] ?? 999
              const bfi = stopOrder[bf] ?? 999
              const bti = stopOrder[bt] ?? 999
              if (afi !== bfi) return isReverseKurs ? (bfi - afi) : (afi - bfi)
              return Math.abs(ati - afi) - Math.abs(bti - bfi)
            })

          let kursObC1 = 0, kursObC2 = 0;
          let kursTrC1 = 0, kursTrC2 = 0;
          let kursDmC1 = 0, kursDmC2 = 0;

          allOdKeys.forEach(key => {
            const trC1 = odTransfer[key]?.class1 ?? 0;
            const trC2 = odTransfer[key]?.class2 ?? 0;
            const obC1 = odOnBoard[key]?.class1 ?? 0;
            const obC2 = odOnBoard[key]?.class2 ?? 0;
            const dmC1 = odDemand[key]?.class1 ?? 0;
            const dmC2 = odDemand[key]?.class2 ?? 0;
            
            kursTrC1 += trC1; kursTrC2 += trC2;
            kursObC1 += obC1; kursObC2 += obC2;
            kursDmC1 += dmC1; kursDmC2 += dmC2;

            dayTrC1 += trC1; dayTrC2 += trC2;
            dayObC1 += obC1; dayObC2 += obC2;
            dayDmC1 += dmC1; dayDmC2 += dmC2;
          });
          
          const kursOb = kursObC1 + kursObC2;
          const kursTr = kursTrC1 + kursTrC2;
          const kursDm = kursDmC1 + kursDmC2;
          const kursOriginalC1 = kursTrC1 + kursObC1 + kursDmC1;
          const kursOriginalC2 = kursTrC2 + kursObC2 + kursDmC2;
          const kursOriginal = kursOriginalC1 + kursOriginalC2;

          return (
            <div key={s.kurs}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
                <span
                  className={styles.depTime}
                  style={{ fontSize: 11, flexShrink: 0, cursor: 'pointer', color: openTimetable === s.kurs ? '#f0c040' : undefined }}
                  onClick={() => setOpenTimetable(openTimetable === s.kurs ? null : s.kurs)}
                  title="Kliknij aby rozwinąć rozkład stacji"
                >{s.odjazd}</span>
                <span className={styles.statLabel} style={{ flex: 1 }}>{s.miasto} → {s.kierunek || '—'}</span>
                <div
                  onClick={() => setOpenKurs(isOpen ? null : s.kurs)}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0, cursor: 'pointer',
                    justifyContent: 'flex-end', fontSize: 10
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, fontWeight: 'bold' }}>
                    {kursOb > 0 && <span style={{ color: '#e74c3c', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{kursOb}</span>}
                    {kursTr > 0 && <span style={{ color: '#f0c040', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{kursTr}</span>}
                    {kursDm > 0 && <span style={{ color: '#ffffff', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{kursDm}</span>}
                    {(kursOb === 0 && kursTr === 0 && kursDm === 0) && <span style={{ color: '#4a6a4a', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>0</span>}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 65 }}>
                    {kursOriginal > 0 ? (
                      <>
                        <span style={{ color: '#8aa88a', fontWeight: 'bold' }}>/ {kursOriginal} os.</span>
                        <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 6 }}>({[
                          kursOriginalC1 > 0 ? `kl.1: ${Math.round(((kursObC1 + kursTrC1) / kursOriginalC1) * 100)}%` : null,
                          kursOriginalC2 > 0 ? `kl.2: ${Math.round(((kursObC2 + kursTrC2) / kursOriginalC2) * 100)}%` : null
                        ].filter(Boolean).join(' | ')})</span>
                      </>
                    ) : <span style={{ color: '#6a8a6a' }}>brak popytu</span>}
                    {kursRevenue[s.kurs] > 0 && (
                      <div style={{ color: '#4fc3f7', fontSize: 9, marginTop: 2, fontWeight: 'bold' }}>
                        {kursRevenue[s.kurs].toLocaleString('pl-PL')} PLN
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Timetable: all stops for this kurs */}
              {openTimetable === s.kurs && byKurs[s.kurs] && (
                <div style={{ margin: '2px 0 6px 0', padding: '6px 8px', background: '#0a1a0a', borderLeft: '2px solid #f0c040', fontSize: 10 }}>
                  {byKurs[s.kurs].map((stop, idx) => {
                    const cityName = cities?.find(c => c.id === stop.miasto || c.name === stop.miasto)?.name ?? stop.miasto
                    const isFirst = idx === 0
                    const isLast = idx === byKurs[s.kurs].length - 1
                    const time = stop.przyjazd && stop.odjazd && stop.przyjazd !== stop.odjazd
                      ? `${stop.przyjazd} / ${stop.odjazd}`
                      : stop.odjazd || stop.przyjazd || '—'
                    const awaria = ts.awarie?.[s.kurs]
                    const delayedArrival = isLast && awaria?.isAwaria === 1
                      ? addDelay(stop.przyjazd || stop.odjazd, awaria.awariaTime)
                      : null
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: idx < byKurs[s.kurs].length - 1 ? '1px solid #1a2a1a' : 'none' }}>
                        <span style={{ color: '#f0c040', fontFamily: 'monospace', minWidth: 72, flexShrink: 0 }}>{time}</span>
                        <span style={{ color: isFirst || isLast ? '#ffffff' : '#6a9a6a', fontWeight: isFirst || isLast ? 'bold' : 'normal' }}>
                          {cityName}
                          {delayedArrival && <span style={{ color: '#e74c3c', marginLeft: 6 }}>({delayedArrival})</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* OD breakdown (existing) */}
              {isOpen && odKeys.length > 0 && (
                <div style={{ margin: '2px 0 6px 0', padding: '6px 8px', background: '#0d1f0d', borderLeft: '2px solid #2a4a2a', fontSize: 10 }}>
                  <div style={{ paddingBottom: '6px', marginBottom: '6px', borderBottom: '1px solid #1a2a1a', display: 'flex', gap: '12px', color: '#888' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e74c3c' }}></span>W TRAKCIE JAZDY</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0c040' }}></span>ZAKOŃCZYLI</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffffff' }}></span>OCZEKUJĄCY</span>
                  </div>
                  {(() => {
                    let totalObC1 = 0, totalObC2 = 0;
                    let totalTrC1 = 0, totalTrC2 = 0;
                    let totalDmC1 = 0, totalDmC2 = 0;

                    const rows = odKeys.map((key) => {
                      const [fromId, toId] = key.split(':')
                      const fromName = cities?.find(c => c.id === fromId)?.name ?? fromId
                      const toName = cities?.find(c => c.id === toId)?.name ?? toId
                      
                      const trC1 = odTransfer[key]?.class1 ?? 0;
                      const trC2 = odTransfer[key]?.class2 ?? 0;
                      const obC1 = odOnBoard[key]?.class1 ?? 0;
                      const obC2 = odOnBoard[key]?.class2 ?? 0;
                      const dmC1 = odDemand[key]?.class1 ?? 0;
                      const dmC2 = odDemand[key]?.class2 ?? 0;

                      const tr = trC1 + trC2;
                      const ob = obC1 + obC2;
                      const dm = dmC1 + dmC2;
                      
                      totalTrC1 += trC1; totalTrC2 += trC2;
                      totalObC1 += obC1; totalObC2 += obC2;
                      totalDmC1 += dmC1; totalDmC2 += dmC2;

                      let displayCount = null;
                      let displayColor = '#ffffff'; 
                      
                      if (ob > 0) {
                        displayCount = ob;
                        displayColor = '#e74c3c'; 
                      } else if (tr > 0) {
                        displayCount = tr;
                        displayColor = '#f0c040'; 
                      } else {
                        displayCount = dm; 
                        displayColor = '#ffffff'; 
                      }

                      const originalC1 = trC1 + obC1 + dmC1;
                      const originalC2 = trC2 + obC2 + dmC2;
                      const originalDemand = originalC1 + originalC2;

                      return (
                        <div key={key} style={{ display: 'flex', gap: 6, padding: '2px 0', borderBottom: '1px solid #1a2a1a' }}>
                          <span style={{ flex: 1, color: '#6a9a6a' }}>{fromName} → {toName}</span>
                          {(displayCount > 0 || originalDemand > 0) && (
                            <span style={{ 
                              color: displayColor, fontWeight: 'bold', minWidth: 26, textAlign: 'center',
                              border: '1px solid #2a3a2a', borderRadius: 4, padding: '1px 5px', background: 'rgba(0,0,0,0.2)'
                            }}>
                              {displayCount > 0 ? displayCount : '0'}
                            </span>
                          )}
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#6a8a6a', fontWeight: 'bold' }}>/ {originalDemand}</span>
                            {originalDemand > 0 && (
                              <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 4 }}>({[
                                originalC1 > 0 ? `kl.1: ${Math.round(((obC1 + trC1) / originalC1) * 100)}%` : null,
                                originalC2 > 0 ? `kl.2: ${Math.round(((obC2 + trC2) / originalC2) * 100)}%` : null
                              ].filter(Boolean).join(' | ')})</span>
                            )}
                          </div>
                        </div>
                      )
                    });

                    let totalOb = totalObC1 + totalObC2;
                    let totalTr = totalTrC1 + totalTrC2;
                    let totalDm = totalDmC1 + totalDmC2;
                    let totalOriginalC1 = totalTrC1 + totalObC1 + totalDmC1;
                    let totalOriginalC2 = totalTrC2 + totalObC2 + totalDmC2;
                    let totalOriginal = totalOriginalC1 + totalOriginalC2;

                    return (
                      <>
                        {rows}
                        <div style={{ display: 'flex', gap: 6, paddingTop: '6px', marginTop: '4px', borderTop: '1px dashed #2a4a2a', fontWeight: 'bold' }}>
                          <span style={{ flex: 1, color: '#888' }}>SUMA</span>
                          <div style={{ display: 'flex', gap: '4px', textAlign: 'right', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {totalOb > 0 && <span style={{ color: '#e74c3c', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{totalOb}</span>}
                            {totalTr > 0 && <span style={{ color: '#f0c040', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{totalTr}</span>}
                            {totalDm > 0 && <span style={{ color: '#ffffff', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{totalDm}</span>}
                          </div>
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#8aa88a', fontWeight: 'bold' }}>/ {totalOriginal}</span>
                            {totalOriginal > 0 && (
                              <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 4 }}>({[
                                totalOriginalC1 > 0 ? `kl.1: ${Math.round(((totalObC1 + totalTrC1) / totalOriginalC1) * 100)}%` : null,
                                totalOriginalC2 > 0 ? `kl.2: ${Math.round(((totalObC2 + totalTrC2) / totalOriginalC2) * 100)}%` : null
                              ].filter(Boolean).join(' | ')})</span>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )
        })}

        {(() => {
          const dayOb = dayObC1 + dayObC2;
          const dayTr = dayTrC1 + dayTrC2;
          const dayDm = dayDmC1 + dayDmC2;
          const dayOriginalC1 = dayTrC1 + dayObC1 + dayDmC1;
          const dayOriginalC2 = dayTrC2 + dayObC2 + dayDmC2;
          const dayOriginal = dayOriginalC1 + dayOriginalC2;

          return (
            <div style={{ 
              display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 8px 6px 8px', marginTop: 8,
              borderTop: '2px dashed #1a2a1a', background: 'rgba(25, 45, 25, 0.2)', borderRadius: '0 0 6px 6px'
            }}>
              <span style={{ flex: 1, color: '#8ab88a', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 }}>PODSUMOWANIE DNIA</span>
              <div
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0,
                  justifyContent: 'flex-end', fontSize: 10
                }}
              >
                <div style={{ display: 'flex', gap: 4, fontWeight: 'bold' }}>
                  {dayOb > 0 && <span style={{ color: '#e74c3c', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{dayOb}</span>}
                  {dayTr > 0 && <span style={{ color: '#f0c040', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{dayTr}</span>}
                  {dayDm > 0 && <span style={{ color: '#ffffff', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>{dayDm}</span>}
                  {(dayOb === 0 && dayTr === 0 && dayDm === 0) && <span style={{ color: '#4a6a4a', border: '1px solid #3a4a3a', borderRadius: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.2)' }}>0</span>}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 65 }}>
                  {dayOriginal > 0 ? (
                    <>
                      <span style={{ color: '#8aa88a', fontWeight: 'bold' }}>/ {dayOriginal} os..</span>
                      <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 6 }}>({[
                        dayOriginalC1 > 0 ? `kl.1: ${Math.round(((dayObC1 + dayTrC1) / dayOriginalC1) * 100)}%` : null,
                        dayOriginalC2 > 0 ? `kl.2: ${Math.round(((dayObC2 + dayTrC2) / dayOriginalC2) * 100)}%` : null
                      ].filter(Boolean).join(' | ')})</span>
                    </>
                  ) : <span style={{ color: '#6a8a6a' }}>brak popytu</span>}
                  {totalDailyRevenue > 0 && (
                    <div style={{ color: '#4fc3f7', fontSize: 10, marginTop: 2, fontWeight: 'bold' }}>
                      {totalDailyRevenue.toLocaleString('pl-PL')} PLN
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </div>}
    </section>
  )
}
