import React from 'react';
import styles from './SchedulePlanner.module.css';

export default function ScheduleTimeline({ 
    activeCourse, 
    courses, 
    getCityById, 
    highlightedStop, 
    handleTimeChange 
}) {
    if (!activeCourse) return null;

    return (
        <div className={styles.timeline}>
            <div className={styles.sectionTitle} style={{ marginBottom: '20px' }}>Szczegóły Kursu {activeCourse.id}</div>

            <div className={styles.timelineHeader}>
                <div className={styles.colStation}>Stacja</div>
                <div className={styles.colArr}>Przyjazd</div>
                <div className={styles.colDep}>Odjazd</div>
                <div className={styles.colTravel}>Czas przejazdu</div>
            </div>

            {activeCourse.stops.map((stop, sIdx) => {
                const city = getCityById(stop.cityId);
                const isTerminal = sIdx === activeCourse.stops.length - 1;
                const isOrigin = sIdx === 0;
                const courseIndex = courses.findIndex(c => c.id === activeCourse.id);

                return (
                    <div key={stop.cityId} className={styles.timelineRow}>
                        <div className={styles.colStation}>
                            <span className={`${styles.stationName} ${isTerminal || isOrigin ? styles.stationTerminal : ''}`}>
                                {city?.name}
                            </span>
                        </div>
                        <div className={styles.colArr}>
                            <span>{stop.arrival || '—'}</span>
                        </div>
                        <div className={styles.colDep}>
                            {isTerminal ? (
                                <span>—</span>
                            ) : (
                                <input
                                    type="time"
                                    className={styles.timeInput}
                                    style={
                                        highlightedStop?.courseId === activeCourse.id && highlightedStop?.stopIndex === sIdx
                                            ? { boxShadow: '0 0 0 2px #e74c3c', borderColor: '#e74c3c' }
                                            : {}
                                    }
                                    value={stop.departure}
                                    onChange={(e) => handleTimeChange(courseIndex, sIdx, e.target.value)}
                                />
                            )}
                        </div>
                        <div className={styles.colTravel}>
                            {isOrigin ? (
                                <span className={styles.travelTime}>—</span>
                            ) : (
                                <span className={styles.travelTime}>+{stop.travelFromPrev} min</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
