import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import TrainComposer from './TrainComposer'
import styles from './FleetCompositions.module.css'

export default function FleetCompositions() {
    // Pobieramy całą flotę (trains), wygenerowane składy (trainsSets) i opublikowane trasy (routes)
    const { trainsSets, trains, routes } = useGame()
    const [isComposing, setIsComposing] = useState(false)

    if (isComposing) {
        return <TrainComposer onCancel={() => setIsComposing(false)} />
    }

    return (
        <div className={styles.compositionsContainer}>
            <div className={styles.compositionBoard}>
                <div className={styles.boardHeader}>
                    <h3>Aktualnie zmontowane pociągi na bazie ({trainsSets?.length || 0})</h3>
                    <button className={styles.createBtn} onClick={() => setIsComposing(true)}>+ Nowy Skład</button>
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

                            return (
                                <div key={trainSet.id} className={styles.compositionCard}>
                                    <div className={styles.cardTop}>
                                        <h4>{trainSet.name}</h4>
                                        <div>
                                            {trainSet.routePath || attachedRoute ? (
                                                <div className={styles.routeBadgeWrapper}>
                                                    <span className={styles.routeBadge}>
                                                        {trainSet.routePath || `${attachedRoute.from} ➔ ${attachedRoute.to}`}
                                                    </span>
                                                    <div className={styles.customTooltip}>
                                                        {formattedSchedule.trim()}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className={styles.routeBadgeEmpty}>W Stoczni</span>
                                            )}
                                        </div>
                                    </div>

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

                                    <div className={styles.cardFooter}>
                                        <div className={styles.statsRow}>
                                            <span>Miejsca:<strong>{trainSet.totalSeats}</strong></span>
                                            <span>Koszt:<strong>{trainSet.totalCostPerKm} PLN/km</strong></span>
                                            <span>Max V:<strong>{trainSet.maxSpeed} km/h</strong></span>
                                        </div>
                                        <button className={styles.compActionBtn}>Rozwiąż</button>
                                    </div>
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
