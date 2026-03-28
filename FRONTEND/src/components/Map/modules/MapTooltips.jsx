import React from 'react'
import styles from '../PolandMap.module.css'

export function MapTooltips({
    hoveredCity,
    hoveredRoute,
    hoveredTrain,
    hoveredCityPos,
    size,
    cities,
    getCityById,
    getTrainById,
    cityDemandInfo,
    gameTime,
}) {
    if (!hoveredCity && !hoveredRoute && !hoveredTrain) return null

    return (
        <>
            {(hoveredCity || hoveredRoute) && (
                <div
                    className={styles.tooltip}
                    style={hoveredCity && hoveredCityPos ? {
                        left: Math.min(hoveredCityPos.x + 14, size.x - 200),
                        top: Math.max(hoveredCityPos.y + 8, 4),
                        bottom: 'auto',
                    } : {}}
                >
                    {hoveredCity && (
                        <>
                            <strong>{hoveredCity.name}</strong>
                            {(hoveredCity.country || hoveredCity.voivodeship || hoveredCity.population) && (
                                <span>
                                    {hoveredCity.country
                                        ? `${hoveredCity.country}${hoveredCity.population ? ' · ' + hoveredCity.population.toLocaleString('pl-PL') + ' mk.' : ''}`
                                        : hoveredCity.voivodeship
                                            ? `${hoveredCity.voivodeship} · ${hoveredCity.population?.toLocaleString('pl-PL')} mk.`
                                            : `${hoveredCity.population?.toLocaleString('pl-PL')} mk.`}
                                </span>
                            )}
                            {hoveredCity.platforms && (
                                <span>{hoveredCity.platforms} {hoveredCity.platforms === 1 ? 'peron' : hoveredCity.platforms < 5 ? 'perony' : 'peronów'}</span>
                            )}
                            {cityDemandInfo?.rows?.length > 0 && (
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, borderTop: '1px solid #2a4a2a', paddingTop: 4 }}>
                                    <span style={{ color: '#8aab8a', fontSize: 10, marginBottom: 1 }}>
                                        Odjazdy w godz. {gameTime?.split(':')[0]}:xx
                                    </span>
                                    {cityDemandInfo.rows.map((row, i) => {
                                        const pct = row.kursTotal > 0
                                            ? Math.round((row.demand / row.kursTotal) * 1000) / 10
                                            : 0
                                        return (
                                            <span key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                <span style={{ color: '#f0c040', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, flexShrink: 0 }}>{row.departure}</span>
                                                <span style={{ color: '#c0d0c0', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.tsName}</span>
                                                <span style={{ color: '#4caf50', fontSize: 10, flexShrink: 0 }}>{row.demand}</span>
                                                <span style={{ color: '#6a8a6a', fontSize: 10, flexShrink: 0 }}>{pct}% dob.</span>
                                            </span>
                                        )
                                    })}
                                </span>
                            )}
                        </>
                    )}
                    {hoveredRoute && !hoveredCity && (
                        <>
                            <strong>
                                {getCityById(hoveredRoute.from)?.name} ↔ {getCityById(hoveredRoute.to)?.name}
                            </strong>
                            <span>
                                {hoveredRoute.distance} km
                                {hoveredRoute.trainId ? ` · ${getTrainById(hoveredRoute.trainId)?.name}` : ' · brak pociągu'}
                            </span>
                        </>
                    )}
                </div>
            )}

            {hoveredTrain && (() => {
                const { ts, kursId, kursStops, x, y } = hoveredTrain
                const pricing = ts.pricing ?? {}
                return (
                    <div
                        className={styles.tooltip}
                        style={{ left: Math.min(x + 14, size.x - 210), top: Math.max(y - 10, 4), bottom: 'auto' }}
                    >
                        <strong>{ts.name}</strong>
                        {kursStops?.length > 0 && (() => {
                            const ct = ts.currentTransfer?.[kursId] ?? {}
                            const dt = ts.dailyTransfer?.[kursId] ?? {}
                            const onBoard = ct.onBoard ?? {}
                            const alighted = dt.od ?? {}
                            const totalOnBoard = ct.totalOnBoard ?? 0
                            const totalSeats = ts.totalSeats ?? '—'

                            return (
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {kursStops.map((stop, idx) => {
                                        const isFirst = idx === 0
                                        const isLast = idx === kursStops.length - 1
                                        const cityId = cities.find(c => c.id === stop.miasto || c.name === stop.miasto)?.id ?? stop.miasto
                                        const cityName = cities.find(c => c.id === cityId)?.name ?? stop.miasto
                                        const time = isLast ? (stop.przyjazd || stop.odjazd) : stop.odjazd

                                        const obEntries = Object.entries(onBoard).filter(([k]) => k.split(':')[1] === cityId)
                                        const alEntries = Object.entries(alighted).filter(([k]) => k.split(':')[1] === cityId)
                                        const obCount = obEntries.reduce((s, [, v]) => s + (v.class1 || 0) + (v.class2 || 0), 0)
                                        const alCount = alEntries.reduce((s, [, v]) => s + (v.class1 || 0) + (v.class2 || 0), 0)

                                        return (
                                            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ color: '#f0c040', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, minWidth: 38, flexShrink: 0 }}>
                                                    {time || '—'}
                                                </span>
                                                <span style={{ color: isFirst || isLast ? '#fff' : '#8aab8a', fontWeight: isFirst || isLast ? 600 : 400, fontSize: isFirst || isLast ? '1em' : '0.92em', flex: 1 }}>
                                                    {cityName}
                                                </span>
                                                {obCount > 0 && <span style={{ color: '#f0c040', fontSize: 10 }}>{obCount}</span>}
                                                {alCount > 0 && <span style={{ color: '#4a6a4a', fontSize: 10 }}>{alCount}</span>}
                                            </span>
                                        )
                                    })}
                                    {(totalOnBoard > 0 || ts.totalSeats) && (
                                        <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, borderTop: '1px solid #2a4a2a', paddingTop: 3, marginTop: 1 }}>
                                            <span style={{ color: '#f0c040', fontSize: 11 }}>{totalOnBoard}</span>
                                            <span style={{ color: '#4a6a4a', fontSize: 10 }}>/ {totalSeats}</span>
                                        </span>
                                    )}
                                </span>
                            )
                        })()}
                        {pricing.class1Per100km != null && (
                            <span style={{ color: '#8aab8a', fontSize: '0.9em' }}>
                                PLN/100km: <span style={{ color: '#c0d0c0' }}>{pricing.class1Per100km}</span>
                                {' / '}
                                <span style={{ color: '#c0d0c0' }}>{pricing.class2Per100km}</span>
                            </span>
                        )}
                    </div>
                )
            })()}
        </>
    )
}
