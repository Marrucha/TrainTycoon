import { createPortal } from 'react-dom'
import { useGame } from '../../context/GameContext'
import useScheduleCourses from './useScheduleCourses'
import ScheduleTimeline from './ScheduleTimeline'
import styles from './SchedulePlanner.module.css'

export default function SchedulePlanner({ trainSet, onClose }) {
    const { getCityById } = useGame()
    const {
        courses,
        activeCourseId,
        setActiveCourseId,
        validationError,
        saveSuccess,
        highlightedStop,
        handleAddCourse,
        handleRemoveLastCourse,
        handleTimeChange,
        handleSave,
    } = useScheduleCourses(trainSet)

    const activeCourse = courses.find(c => c.id === activeCourseId)

    return createPortal(
        <div className={styles.overlay}>
            <header className={styles.header}>
                <h2>Harmonogram: {trainSet.name}</h2>
                <button className={styles.closeBtn} onClick={onClose}>Zamknij</button>
            </header>

            <div className={styles.content}>
                <div className={styles.sidebar}>
                    <div className={styles.sectionTitle}>Cykle Dobowe (Kursy)</div>
                    <div className={styles.infoBox}>
                        <p>Zarządzaj kursami pociągu w przód i w tył na tej trasie.</p>
                        <p><strong>Limity przypomnienie:</strong></p>
                        <p>- Max 11h na pojedynczy kurs</p>
                        <p>- Min 1h postoju na obrócenie składu w terminalu</p>
                        <p>- Kółko musi zamknąć się w punkcie startowym w max 23h</p>
                    </div>

                    <div className={styles.coursesList}>
                        {courses.map(c => {
                            const origin = getCityById(c.stops[0].cityId)?.name
                            const dest = getCityById(c.stops[c.stops.length - 1].cityId)?.name
                            return (
                                <button
                                    key={c.id}
                                    className={`${styles.courseBtn} ${c.id === activeCourseId ? styles.active : ''}`}
                                    onClick={() => setActiveCourseId(c.id)}
                                >
                                    Kurs {c.id}: {origin} ➔ {dest}
                                </button>
                            )
                        })}
                        <button className={styles.addCourseBtn} onClick={handleAddCourse}>
                            {courses.length === 0 ? '+ Dodaj Pierwszy Kurs' : '+ Dodaj Kurs Powrotny'}
                        </button>
                        {courses.length > 0 && (
                            <button
                                className={styles.addCourseBtn}
                                style={{ color: '#e74c3c', borderColor: '#e74c3c' }}
                                onClick={handleRemoveLastCourse}
                            >
                                - Usuń Ostatni
                            </button>
                        )}
                    </div>

                    <div className={styles.actionPanel}>
                        <button className={styles.submitBtn} onClick={handleSave}>
                            Zapisz Rozkład
                        </button>
                        {saveSuccess && (
                            <span style={{ color: '#4caf50', marginLeft: '10px', fontSize: '18px', fontWeight: 'bold' }}>✓</span>
                        )}
                    </div>
                </div>

                <div className={styles.mainArea}>
                    {validationError && (
                        <div className={styles.errorBox}>
                            <span className={styles.errorIcon}>⚠️</span>
                            <span>{validationError}</span>
                        </div>
                    )}

                    <ScheduleTimeline
                        activeCourse={activeCourse}
                        courses={courses}
                        getCityById={getCityById}
                        highlightedStop={highlightedStop}
                        handleTimeChange={handleTimeChange}
                    />
                </div>
            </div>
        </div>,
        document.body
    )
}
