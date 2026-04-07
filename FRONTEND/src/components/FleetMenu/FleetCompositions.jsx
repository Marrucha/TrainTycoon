import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import ConfirmButton from '../common/ConfirmButton'
import TrainComposer from './TrainComposer'
import PricingPanel from './PricingPanel'
import RoutePlanner from './RoutePlanner'
import SchedulePlanner from './SchedulePlanner'
import TrainTimeline from './TrainTimeline'
import CrewSection from '../Sidebar/trainset/CrewSection'
import styles from './FleetCompositions.module.css'
import pricingStyles from './PricingPanel.module.css'

export default function FleetCompositions() {
    // Pobieramy całą flotę (trains), wygenerowane składy (trainsSets) i opublikowane trasy (routes)
    const { trainsSets, trains, routes, cities, defaultPricing, updateTicketPrice, updateDefaultPricing, updateCitySchedules, employees, disbandTrainSet, gameConstants } = useGame()
    const [isComposing, setIsComposing] = useState(false)
    const [editingTrainSet, setEditingTrainSet] = useState(null)
    const [pricingOpenFor, setPricingOpenFor] = useState(null) // id składu z otwartym cennikiem
    const [routingOpenFor, setRoutingOpenFor] = useState(null) // skład dla RoutePlanner
    const [schedulingOpenFor, setSchedulingOpenFor] = useState(null) // skład dla SchedulePlanner
    const [crewOpenFor, setCrewOpenFor] = useState(null) // id składu z otwartą obsadą
    const [collapsedCards, setCollapsedCards] = useState({}) // id → bool

    // Skrócona nazwa pracownika: "J. Kowalski"
    const empShortName = (id) => {
        if (!id) return '—'
        const e = employees?.find(emp => emp.id === id)
        if (!e) return '?'
        const parts = (e.name || '').split(' ')
        return parts.length >= 2 ? `${parts[0][0]}. ${parts[1]}` : e.name
    }

    // Pełny tooltip pracownika
    const empTooltip = (id) => {
        if (!id) return ''
        const e = employees?.find(emp => emp.id === id)
        if (!e) return ''
        const lines = [e.name]
        if (e.dateOfBirth) {
            const b = new Date(e.dateOfBirth), now = new Date()
            let age = now.getFullYear() - b.getFullYear()
            const mo = now.getMonth() - b.getMonth()
            if (mo < 0 || (mo === 0 && now.getDate() < b.getDate())) age--
            lines.push(`Wiek: ${age} l.`)
        }
        if (e.hiredAt) {
            const months = Math.floor((Date.now() - new Date(e.hiredAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
            const y = Math.floor(months / 12), r = months % 12
            lines.push(`Staż: ${months < 12 ? `${months} mies.` : r > 0 ? `${y} l. ${r} mies.` : `${y} l.`}`)
        }
        const salary = e.isIntern ? 4300 : (e.monthlySalary ?? 0)
        if (salary) lines.push(`Pensja: ${salary.toLocaleString('pl-PL')} PLN/mies.`)
        return lines.join('\n')
    }

    // Tooltip stażysty przypisanego do danego pracownika (mentora)
    const internTooltip = (mentorId) => {
        const intern = employees?.find(e => e.isIntern && e.mentorId === mentorId)
        if (!intern) return null
        const lines = [`Stażysta: ${intern.name}`]
        if (intern.dateOfBirth) {
            const b = new Date(intern.dateOfBirth), now = new Date()
            let age = now.getFullYear() - b.getFullYear()
            const mo = now.getMonth() - b.getMonth()
            if (mo < 0 || (mo === 0 && now.getDate() < b.getDate())) age--
            lines.push(`Wiek: ${age} l.`)
        }
        if (intern.hiredAt) {
            const months = Math.floor((Date.now() - new Date(intern.hiredAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
            lines.push(`Na stażu: ${months < 12 ? `${months} mies.` : `${Math.floor(months/12)} l. ${months%12} mies.`}`)
        }
        if (intern.mentorId && intern.internGraduatesAt) lines.push(`Uprawnienia: ${intern.internGraduatesAt}`)
        lines.push(`Pensja: 4 300 PLN/mies.`)
        return lines.join('\n')
    }

    const toggleCollapse = (id) => setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }))
    const allCollapsed = trainsSets?.length > 0 && trainsSets.every(ts => collapsedCards[ts.id])
    const toggleAll = () => {
        if (allCollapsed) {
            setCollapsedCards({})
        } else {
            setCollapsedCards(Object.fromEntries((trainsSets || []).map(ts => [ts.id, true])))
        }
    }

    if (isComposing) {
        return <TrainComposer onCancel={() => setIsComposing(false)} />
    }

    if (editingTrainSet) {
        return <TrainComposer onCancel={() => setEditingTrainSet(null)} editTrainSet={editingTrainSet} />
    }

    return (
        <div className={styles.compositionsContainer}>
            <div className={styles.compositionBoard}>
                <div className={styles.boardHeader}>
                    <h3>Aktualnie zmontowane pociągi na bazie ({trainsSets?.length || 0})</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {trainsSets?.length > 0 && (
                            <button className={styles.createBtn} onClick={toggleAll}>
                                {allCollapsed ? '▶ Rozwiń wszystkie' : '▼ Zwiń wszystkie'}
                            </button>
                        )}
                        <button className={styles.createBtn} onClick={() => setIsComposing(true)}>+ Nowy Skład</button>
                    </div>
                </div>

                <div className={styles.compositionGrid}>
                    {trainsSets && trainsSets.length > 0 ? (
                        trainsSets.map((trainSet, tsIndex) => {
                            // Algorytm szukania podpietej trasy
                            const attachedRoute = routes.find(r => r.trainId === trainSet.id);

                            // Wyłuskiwanie rzeczywistych obiektow maszyn podpietych do trainSet (by posiadaly bazowe obrazki)
                            const compositionParts = (trainSet.trainIds || []).map(id => trains.find(t => t.id === id)).filter(Boolean);

                            // Algorytm węża tnący na kawałki po 10 wagonow dla widoku karty
                            const snakeRows = [];
                            let i = 0;
                            let isLtoR = true;
                            let expectsConnector = false;

                            while (i < compositionParts.length) {
                                if (expectsConnector) {
                                    snakeRows.push({
                                        items: [compositionParts[i]],
                                        style: isLtoR ? 'connectorRight' : 'connectorLeft'
                                    })
                                    i++;
                                    expectsConnector = false;
                                    isLtoR = !isLtoR;
                                } else {
                                    const chunk = compositionParts.slice(i, i + 10);
                                    snakeRows.push({
                                        items: chunk,
                                        style: isLtoR ? 'fullLtr' : 'fullRtl'
                                    })
                                    i += chunk.length;
                                    if (chunk.length === 10) {
                                        expectsConnector = true;
                                    }
                                }
                            }

                            // Algorytm tooltipa rozkładu
                            let formattedSchedule = '';
                            if (trainSet.rozklad && trainSet.rozklad.length > 0) {
                                const courseMap = new Map();
                                trainSet.rozklad.forEach(r => {
                                    if (!courseMap.has(r.kurs)) courseMap.set(r.kurs, []);
                                    courseMap.get(r.kurs).push(r);
                                });

                                // Sortowanie chronologiczne kursów (według pierwszego odjazdu w relacji)
                                const sortedCourses = Array.from(courseMap.values()).sort((a, b) => a[0].odjazd.localeCompare(b[0].odjazd));

                                let typeCode = "TR";
                                if (trainSet.type === "InterCity" || trainSet.type === "IC") typeCode = "IC";
                                else if (trainSet.type === "Lokomotywa") typeCode = "TLK";
                                else if (trainSet.type) typeCode = trainSet.type.substring(0, 2).toUpperCase();

                                const pociagNum = 100 + tsIndex + 1; // 101, 102 itd based on the index

                                sortedCourses.forEach((stops, cIndex) => {
                                    if (stops.length > 0) {
                                        formattedSchedule += `\n${typeCode} ${pociagNum}-${cIndex + 1} (kier. ${stops[0].kierunek})\n`;
                                        stops.forEach((s, sIdx) => {
                                            const isFirst = sIdx === 0;
                                            const isLast = sIdx === stops.length - 1;

                                            let timeDisplay = '';
                                            if (isFirst) {
                                                timeDisplay = s.odjazd;
                                            } else if (isLast) {
                                                timeDisplay = s.przyjazd;
                                            } else {
                                                timeDisplay = `${s.przyjazd} - ${s.odjazd}`;
                                            }

                                            formattedSchedule += ` • ${s.miasto}: ${timeDisplay}\n`;
                                        });
                                    }
                                });
                            } else if (attachedRoute) {
                                formattedSchedule = `Zwykły Rozkład: ${attachedRoute.departures?.join(' | ') || 'Brak'}`;
                            } else {
                                formattedSchedule = 'Skład oczekuje w Stoczni (Brak tras)';
                            }

                            let routeLabel = null;
                            if (trainSet.routeStops && trainSet.routeStops.length > 0) {
                                routeLabel = trainSet.routeStops.map(id => cities.find(c => c.id === id)?.name).join(' ➔ ');
                            } else if (trainSet.routePath) {
                                routeLabel = trainSet.routePath;
                            } else if (attachedRoute) {
                                routeLabel = `${attachedRoute.from} ➔ ${attachedRoute.to}`;
                            }

                            // Czy rozkład jest faktycznie opublikowany w miastach?
                            const isPublished = cities.some(c =>
                                c.rozklad && c.rozklad.some(r => r.trainSetId === trainSet.id)
                            );

                            const isCollapsed = !!collapsedCards[trainSet.id]

                            // Badge "NEW": czerwony przed trasą, zielony w pierwszym miesiącu gry
                            const timeMultiplier = gameConstants?.TIME_MULTIPLIER || 30
                            const oneGameMonthMs = 30 * 24 * 3600 * 1000 / timeMultiplier
                            const now = Date.now()
                            const newBadge = !trainSet.createdAt ? null
                                : !trainSet.firstRouteAt ? 'red'
                                : (now - new Date(trainSet.firstRouteAt).getTime()) < oneGameMonthMs ? 'green'
                                : null

                            return (
                                <div key={trainSet.id} className={styles.compositionCard}>
                                    <div
                                        className={styles.cardTop}
                                        onClick={() => toggleCollapse(trainSet.id)}
                                        style={{ cursor: 'pointer', userSelect: 'none', borderBottom: isCollapsed ? 'none' : '1px solid #1a331a', paddingBottom: isCollapsed ? 0 : '10px' }}
                                    >
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {trainSet.name}
                                            {newBadge && (
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700, letterSpacing: 1,
                                                    padding: '1px 6px', borderRadius: 3,
                                                    background: newBadge === 'red' ? 'rgba(231,76,60,0.2)' : 'rgba(46,204,113,0.2)',
                                                    border: `1px solid ${newBadge === 'red' ? '#e74c3c' : '#2ecc71'}`,
                                                    color: newBadge === 'red' ? '#e74c3c' : '#2ecc71',
                                                }}>NEW</span>
                                            )}
                                        </h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                            {routeLabel ? (
                                                <div title={routeLabel} style={{ minWidth: 0, overflow: 'hidden' }}>
                                                    <span
                                                        className={styles.routeBadge}
                                                        style={{ backgroundColor: isPublished ? '#1b4332' : 'rgba(240, 192, 64, 0.2)', color: isPublished ? '#4CAF50' : '#f0c040', borderColor: isPublished ? '#2d6a4f' : '#8a6a20' }}
                                                    >
                                                        {routeLabel} {isPublished ? '(W Trasie)' : '(Szkic)'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className={styles.routeBadgeEmpty}>W Stoczni</span>
                                            )}
                                            <span style={{ color: '#4a6a4a', fontSize: '14px', flexShrink: 0 }}>{isCollapsed ? '▶' : '▼'}</span>
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div className={styles.trainAssembly}>
                                            {snakeRows.map((row, rIndex) => (
                                                <div key={rIndex} className={`${styles.snakeRow} ${styles[row.style]}`}>
                                                    {row.items.map((part) => (
                                                        <div key={part.id} className={styles.assemblyPart}>
                                                            {part.imageUrl2 || part.imageUrl ? (
                                                                <div className={styles.imgWrap}>
                                                                    <img src={part.imageUrl2 || part.imageUrl} alt="Pojazd" />
                                                                </div>
                                                            ) : (
                                                                <div className={styles.placeholderBox}>📷</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!isCollapsed && trainSet.rozklad && trainSet.rozklad.length > 0 && (
                                        <TrainTimeline rozklad={trainSet.rozklad} />
                                    )}

                                    {!isCollapsed && (() => {
                                        const crew = trainSet.crew || {}
                                        const nCond = (crew.konduktorzy || []).length
                                        const crewMissing = !crew.maszynista || !crew.kierownik
                                        return (
                                        <div className={styles.cardFooter}>

                                            {/* Linia statystyk */}
                                            <div className={styles.statsRow}>
                                                <span>Miejsca: <strong>{trainSet.totalSeats}</strong></span>
                                                <span>Koszt: <strong>{Number(trainSet.totalCostPerKm).toFixed(2)} PLN/km</strong></span>
                                                <span>Max V: <strong>{trainSet.maxSpeed} km/h</strong></span>
                                            </div>
                                            {/* Przyciski akcji */}
                                            <div className={styles.footerActions}>
                                                <button
                                                    className={styles.pricingBtn}
                                                    onClick={() => setPricingOpenFor(
                                                        pricingOpenFor === trainSet.id ? null : trainSet.id
                                                    )}
                                                >
                                                    {pricingOpenFor === trainSet.id ? '▲ Cennik' : '▼ Cennik'}
                                                </button>
                                                {!isPublished && (
                                                    <button
                                                        className={styles.pricingBtn}
                                                        onClick={() => setRoutingOpenFor(trainSet)}
                                                    >
                                                        Modyfikuj Trasę
                                                    </button>
                                                )}
                                                {!isPublished && trainSet.routeStops && trainSet.routeStops.length > 1 && (
                                                    <button
                                                        className={styles.pricingBtn}
                                                        onClick={() => setSchedulingOpenFor(trainSet)}
                                                    >
                                                        Godziny Jazdy
                                                    </button>
                                                )}
                                                <button
                                                    className={styles.pricingBtn}
                                                    onClick={() => setCrewOpenFor(crewOpenFor === trainSet.id ? null : trainSet.id)}
                                                >
                                                    {crewOpenFor === trainSet.id ? '▲ Kadry' : '▼ Kadry'}
                                                </button>
                                                {trainSet.rozklad && trainSet.rozklad.length > 0 && (
                                                    isPublished ? (
                                                        <button
                                                            className={`${styles.pricingBtn} ${styles.cancelRouteBtn}`}
                                                            onClick={() => {
                                                                updateCitySchedules(trainSet.id, [], {});
                                                            }}
                                                        >
                                                            Odwołaj z Trasy
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className={`${styles.pricingBtn} ${styles.sendRouteBtn}`}
                                                            onClick={() => {
                                                                updateCitySchedules(trainSet.id, trainSet.rozklad, {
                                                                    name: trainSet.name,
                                                                    type: trainSet.type || 'InterCity'
                                                                });
                                                            }}
                                                        >
                                                            Wyślij w Trasę
                                                        </button>
                                                    )
                                                )}
                                                {!isPublished && (
                                                    <button
                                                        className={styles.pricingBtn}
                                                        onClick={() => setEditingTrainSet(trainSet)}
                                                    >
                                                        Edytuj Skład
                                                    </button>
                                                )}
                                                <ConfirmButton
                                                    label="Rozwiąż"
                                                    confirmLabel="Rozwiązać skład?"
                                                    onConfirm={() => {
                                                        if (isPublished) updateCitySchedules(trainSet.id, [], {});
                                                        disbandTrainSet(trainSet.id, employees);
                                                    }}
                                                    btnClass={`${styles.pricingBtn} ${styles.disbandBtn}`}
                                                />
                                            </div>
                                        </div>
                                        )
                                    })()}

                                    {!isCollapsed && crewOpenFor === trainSet.id && (
                                        <div className={pricingStyles.panel}>
                                            <div className={pricingStyles.panelHeader}>
                                                <span className={pricingStyles.panelTitle}>KADRY — {trainSet.name}</span>
                                                <button className={pricingStyles.closeBtn} onClick={() => setCrewOpenFor(null)}>✕</button>
                                            </div>
                                            <div className={styles.crewPanel}>
                                                <CrewSection ts={trainSet} editable />
                                            </div>
                                        </div>
                                    )}

                                    {!isCollapsed && pricingOpenFor === trainSet.id && (
                                        <PricingPanel
                                            trainSet={trainSet}
                                            routes={routes}
                                            cities={cities}
                                            customConfig={trainSet.pricing ?? null}
                                            defaultConfig={defaultPricing}
                                            onSaveCustom={config => {
                                                updateTicketPrice(trainSet.id, config)
                                                setPricingOpenFor(null)
                                            }}
                                            onSaveDefault={config => {
                                                updateDefaultPricing(config)
                                                setPricingOpenFor(null)
                                            }}
                                            onResetToDefault={() => {
                                                updateTicketPrice(trainSet.id, null)
                                                setPricingOpenFor(null)
                                            }}
                                            onClose={() => setPricingOpenFor(null)}
                                        />
                                    )}

                                    {!isCollapsed && routingOpenFor?.id === trainSet.id && (
                                        <RoutePlanner
                                            trainSet={trainSet}
                                            onClose={() => setRoutingOpenFor(null)}
                                        />
                                    )}

                                    {!isCollapsed && schedulingOpenFor?.id === trainSet.id && (
                                        <SchedulePlanner
                                            trainSet={trainSet}
                                            onClose={() => setSchedulingOpenFor(null)}
                                        />
                                    )}
                                </div>
                            )
                        })
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#8aab8a', gridColumn: '1 / -1' }}>
                            Jeszcze nie zmontowałeś żadnego Składu Pociągu, leć do stoczni.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
