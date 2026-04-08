import { useState, useMemo } from 'react'
import { useGame } from '../../context/GameContext'
import TrainComposer from './TrainComposer'
import TrainSetCard from './TrainSetCard'
import styles from './FleetCompositions.module.css'

const SORT_OPTS = [
    { key: 'status',       label: 'Status'           },
    { key: 'firstRouteAt', label: 'Od kiedy kursuje' },
    { key: 'length',       label: 'Długość składu'   },
    { key: 'revenue',      label: 'Przychody (wcz.)' },
    { key: 'occupancy',    label: 'Obłożenie (wcz.)' },
]

export default function FleetCompositions() {
    const {
        trainsSets, trains, routes, cities, defaultPricing,
        updateTicketPrice, updateDefaultPricing, updateCitySchedules,
        employees, disbandTrainSet, gameConstants, gameDate,
    } = useGame()

    const [isComposing, setIsComposing] = useState(false)
    const [editingTrainSet, setEditingTrainSet] = useState(null)
    const [pricingOpenFor, setPricingOpenFor] = useState(null)
    const [routingOpenFor, setRoutingOpenFor] = useState(null)
    const [schedulingOpenFor, setSchedulingOpenFor] = useState(null)
    const [crewOpenFor, setCrewOpenFor] = useState(null)
    const [collapsedCards, setCollapsedCards] = useState({})
    const [sortBy, setSortBy] = useState('firstRouteAt')
    const [sortDir, setSortDir] = useState('desc')

    const getStatusValue = (ts) => {
        const pub = cities.some(c => c.rozklad && c.rozklad.some(r => r.trainSetId === ts.id))
        if (!pub) return 2
        return 1
    }

    const sortedTrainsSets = useMemo(() => {
        if (!trainsSets) return []
        return [...trainsSets].sort((a, b) => {
            let av, bv
            if (sortBy === 'status') {
                av = getStatusValue(a); bv = getStatusValue(b)
            } else if (sortBy === 'firstRouteAt') {
                av = a.firstRouteAt ? new Date(a.firstRouteAt).getTime() : 0
                bv = b.firstRouteAt ? new Date(b.firstRouteAt).getTime() : 0
            } else if (sortBy === 'length') {
                av = (a.trainIds || []).length; bv = (b.trainIds || []).length
            } else if (sortBy === 'revenue') {
                av = a.prevDayRevenue ?? 0; bv = b.prevDayRevenue ?? 0
            } else if (sortBy === 'occupancy') {
                av = a.prevDayOccupancy ?? 0; bv = b.prevDayOccupancy ?? 0
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1
            if (av > bv) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    }, [trainsSets, sortBy, sortDir, cities])

    const toggleCollapse = (id) => setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }))
    const allCollapsed = sortedTrainsSets.length > 0 && sortedTrainsSets.every(ts => collapsedCards[ts.id])
    const toggleAll = () => {
        if (allCollapsed) {
            setCollapsedCards({})
        } else {
            setCollapsedCards(Object.fromEntries(sortedTrainsSets.map(ts => [ts.id, true])))
        }
    }

    const handleSort = (key) => {
        setSortDir(prev => sortBy === key ? (prev === 'asc' ? 'desc' : 'asc') : (key === 'firstRouteAt' ? 'desc' : 'asc'))
        setSortBy(key)
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

                {sortedTrainsSets.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#6a8a6a', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginRight: 4 }}>Sortuj:</span>
                        {SORT_OPTS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => handleSort(opt.key)}
                                style={{
                                    background: sortBy === opt.key ? '#2a4a2a' : '#0a150a',
                                    color: sortBy === opt.key ? '#f0c040' : '#8aab8a',
                                    border: `1px solid ${sortBy === opt.key ? '#f0c040' : '#2a4a2a'}`,
                                    borderRadius: 4, padding: '4px 10px', fontSize: 10,
                                    fontWeight: 700, cursor: 'pointer',
                                    textTransform: 'uppercase', letterSpacing: 1,
                                }}
                            >
                                {opt.label} {sortBy === opt.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                            </button>
                        ))}
                    </div>
                )}

                <div className={styles.compositionGrid}>
                    {sortedTrainsSets.length > 0 ? (
                        sortedTrainsSets.map((trainSet, tsIndex) => (
                            <TrainSetCard
                                key={trainSet.id}
                                trainSet={trainSet}
                                tsIndex={tsIndex}
                                trains={trains}
                                routes={routes}
                                cities={cities}
                                employees={employees}
                                gameDate={gameDate}
                                gameConstants={gameConstants}
                                defaultPricing={defaultPricing}
                                isCollapsed={!!collapsedCards[trainSet.id]}
                                onToggleCollapse={toggleCollapse}
                                onEditTrainSet={setEditingTrainSet}
                                pricingOpenFor={pricingOpenFor}     setPricingOpenFor={setPricingOpenFor}
                                routingOpenFor={routingOpenFor}     setRoutingOpenFor={setRoutingOpenFor}
                                schedulingOpenFor={schedulingOpenFor} setSchedulingOpenFor={setSchedulingOpenFor}
                                crewOpenFor={crewOpenFor}           setCrewOpenFor={setCrewOpenFor}
                                updateTicketPrice={updateTicketPrice}
                                updateDefaultPricing={updateDefaultPricing}
                                updateCitySchedules={updateCitySchedules}
                                disbandTrainSet={disbandTrainSet}
                            />
                        ))
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
