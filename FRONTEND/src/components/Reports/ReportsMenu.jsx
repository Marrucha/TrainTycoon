import { useState, useEffect, useMemo, Fragment } from 'react'
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import styles from './ReportsMenu.module.css'

export default function ReportsMenu() {
  const [activeTab, setActiveTab] = useState('daily') // daily, weekly, monthly, yearly, trends
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedTS, setExpandedTS] = useState(null)
  const [selectedDailyIdx, setSelectedDailyIdx] = useState(0)
  const [selectedWeekKey, setSelectedWeekKey] = useState(null)
  const [selectedMonthKey, setSelectedMonthKey] = useState(null)
  const [selectedYearKey, setSelectedYearKey] = useState(null)
  const [selectedTrendMonth, setSelectedTrendMonth] = useState(null)
  const [trendView, setTrendView] = useState('monthly') // 'monthly' | 'yearly'
  const [selectedTrendYear, setSelectedTrendYear] = useState(null)

  const coverageDate = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

  const getISOWeek = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.getDay() || 7
    d.setDate(d.getDate() + 4 - day)
    const yearStart = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
  }

  const MONTH_NAMES_PL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']

  useEffect(() => {
    // Fetch last 30 reports for display and trends
    const q = query(
      collection(db, 'players/player1/Raporty'),
      orderBy('date', 'desc'),
      limit(365) // Increased to allow for yearly data if available
    )

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => doc.data())
      setReports(data)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const calcDaily = (report) => {
    let revenue = 0, revenueC1 = 0, revenueC2 = 0
    let km = 0, cost = 0
    let transferred = 0, transferredC1 = 0, transferredC2 = 0
    let demandTotal = 0, demandC1 = 0, demandC2 = 0
    let wagonCount = 0, locoCount = 0

    if (report?.trainSets) {
      Object.values(report.trainSets).forEach(ts => {
        const mainRev = ts.daily?.przychod || 0
        let c1r = ts.daily?.przychodC1 || 0
        let c2r = ts.daily?.przychodC2 || 0

        if (mainRev > 0 && c1r === 0 && c2r === 0) {
          const t1 = ts.daily?.transferred?.class1 || 0
          const t2 = ts.daily?.transferred?.class2 || 0
          const totalT = t1 + t2
          if (totalT > 0) {
            const weight1 = t1 * 1.6, weight2 = t2 * 1.0
            const totalW = weight1 + weight2
            c1r = (weight1 / totalW) * mainRev
            c2r = (weight2 / totalW) * mainRev
          }
        }

        revenue += mainRev; revenueC1 += c1r; revenueC2 += c2r
        km += ts.daily?.km || 0
        transferred += ts.daily?.transferred?.total || 0
        transferredC1 += ts.daily?.transferred?.class1 || 0
        transferredC2 += ts.daily?.transferred?.class2 || 0
        demandTotal += ts.daily?.totalDemand?.total || 0
        demandC1 += ts.daily?.totalDemand?.class1 || 0
        demandC2 += ts.daily?.totalDemand?.class2 || 0
        cost += ts.daily?.koszt || 0
        wagonCount += ts.daily?.wagonCount || 0
        locoCount += ts.daily?.locoCount || 0
      })
    }

    return {
      revenue, revenueC1, revenueC2,
      km, cost, netto: revenue - cost,
      transferred, transferredC1, transferredC2,
      demandTotal, demandC1, demandC2,
      wagonCount, locoCount,
      realizationTotal: demandTotal > 0 ? transferred / demandTotal : 0,
      realizationC1: demandC1 > 0 ? transferredC1 / demandC1 : 0,
      realizationC2: demandC2 > 0 ? transferredC2 / demandC2 : 0
    }
  }

  // Aggregates
  const aggregates = useMemo(() => {
    if (reports.length === 0) return null

    const calcPeriod = (slice) => {
        const agg = { 
          revenue: 0, revenueC1: 0, revenueC2: 0,
          km: 0, cost: 0, count: slice.length, byTrainSet: {},
          transferred: 0, transferredC1: 0, transferredC2: 0,
          demandTotal: 0, demandC1: 0, demandC2: 0
        }
        
        slice.forEach(r => {
            const d = calcDaily(r)
            agg.revenue += d.revenue
            agg.revenueC1 += d.revenueC1
            agg.revenueC2 += d.revenueC2
            agg.km += d.km
            agg.cost += d.cost
            agg.transferred += d.transferred
            agg.transferredC1 += d.transferredC1
            agg.transferredC2 += d.transferredC2
            agg.demandTotal += d.demandTotal
            agg.demandC1 += d.demandC1
            agg.demandC2 += d.demandC2

            if (r.trainSets) {
              Object.entries(r.trainSets).forEach(([tsId, ts]) => {
                if (!agg.byTrainSet[tsId]) {
                  agg.byTrainSet[tsId] = { 
                    name: ts.name, 
                    revenue: 0, 
                    revenueC1: 0,
                    revenueC2: 0,
                    km: 0, 
                    transferred: 0, 
                    transferredC1: 0,
                    transferredC2: 0,
                    demandC1: 0,
                    demandC2: 0,
                    cost: 0, 
                    daysActive: 0,
                    realizacje: []
                  }
                }
                const tsb = agg.byTrainSet[tsId]
                tsb.revenue += ts.daily?.przychod || 0
                tsb.revenueC1 += ts.daily?.przychodC1 || 0
                tsb.revenueC2 += ts.daily?.przychodC2 || 0
                tsb.km += ts.daily?.km || 0
                tsb.transferred += ts.daily?.transferred?.total || 0
                tsb.transferredC1 += ts.daily?.transferred?.class1 || 0
                tsb.transferredC2 += ts.daily?.transferred?.class2 || 0
                tsb.demandC1 += ts.daily?.totalDemand?.class1 || 0
                tsb.demandC2 += ts.daily?.totalDemand?.class2 || 0
                tsb.cost += ts.daily?.koszt || 0
                tsb.daysActive += 1
                if (ts.daily?.realizacja !== undefined) tsb.realizacje.push(ts.daily.realizacja)

                // Aggregate kursy over the period
                if (ts.kursy) {
                  if (!tsb.kursy) tsb.kursy = {}
                  Object.entries(ts.kursy).forEach(([kId, k]) => {
                    if (!tsb.kursy[kId]) {
                      tsb.kursy[kId] = {
                        odjazd: k.odjazd,
                        from: k.from,
                        to: k.to,
                        przychod: 0,
                        przychodC1: 0,
                        przychodC2: 0,
                        koszt: 0,
                        km: 0,
                        transferredTotal: 0,
                        transferredC1: 0,
                        transferredC2: 0,
                        demandC1: 0,
                        demandC2: 0,
                        realizacje: []
                      }
                    }
                    const kb = tsb.kursy[kId]
                    kb.przychod += k.przychod || 0
                    kb.przychodC1 += k.przychodC1 || 0
                    kb.przychodC2 += k.przychodC2 || 0
                    kb.koszt += k.koszt || 0
                    kb.km += k.km || 0
                    kb.transferredTotal += k.transferred?.total || 0
                    kb.transferredC1 += k.transferred?.class1 || 0
                    kb.transferredC2 += k.transferred?.class2 || 0
                    kb.demandC1 += k.totalDemand?.class1 || 0
                    kb.demandC2 += k.totalDemand?.class2 || 0
                    if (k.realizacja !== undefined) kb.realizacje.push(k.realizacja)
                  })
                }
              })
            }
        })
        agg.netto = agg.revenue - agg.cost
        agg.avgRealizacjaTotal = agg.demandTotal > 0 ? agg.transferred / agg.demandTotal : 0
        agg.avgRealizacjaC1 = agg.demandC1 > 0 ? agg.transferredC1 / agg.demandC1 : 0
        agg.avgRealizacjaC2 = agg.demandC2 > 0 ? agg.transferredC2 / agg.demandC2 : 0
        
        // Finalize per-trainset and per-kurs averages
        Object.values(agg.byTrainSet).forEach(tsb => {
          tsb.netto = tsb.revenue - tsb.cost
          tsb.avgRealizacja = tsb.realizacje.length > 0 
            ? tsb.realizacje.reduce((a, b) => a + b, 0) / tsb.realizacje.length 
            : 0
          tsb.avgRealizacjaC1 = tsb.demandC1 > 0 ? tsb.transferredC1 / tsb.demandC1 : 0
          tsb.avgRealizacjaC2 = tsb.demandC2 > 0 ? tsb.transferredC2 / tsb.demandC2 : 0
            
          if (tsb.kursy) {
            Object.values(tsb.kursy).forEach(kb => {
              kb.netto = kb.przychod - kb.koszt
              kb.avgRealizacja = kb.realizacje.length > 0
                ? kb.realizacje.reduce((a, b) => a + b, 0) / kb.realizacje.length
                : 0
              kb.avgRealizacjaC1 = kb.demandC1 > 0 ? kb.transferredC1 / kb.demandC1 : 0
              kb.avgRealizacjaC2 = kb.demandC2 > 0 ? kb.transferredC2 / kb.demandC2 : 0
            })
          }
        })

        return agg
    }

    return { calcPeriod, trendData: [...reports].reverse().map(r => ({ date: coverageDate(r.date), ...calcDaily(r) })) }
  }, [reports])

  const availablePeriods = useMemo(() => {
    if (!reports.length) return { weekMap: {}, monthMap: {}, yearMap: {}, weeks: [], months: [], years: [] }
    const weekMap = {}, monthMap = {}, yearMap = {}
    reports.forEach(r => {
      const cd = coverageDate(r.date)
      if (!cd) return
      const wk = getISOWeek(cd)
      const mo = cd.slice(0, 7)
      const yr = cd.slice(0, 4)
      if (!weekMap[wk]) weekMap[wk] = []
      weekMap[wk].push(r)
      if (!monthMap[mo]) monthMap[mo] = []
      monthMap[mo].push(r)
      if (!yearMap[yr]) yearMap[yr] = []
      yearMap[yr].push(r)
    })
    return {
      weekMap, monthMap, yearMap,
      weeks: Object.keys(weekMap).sort().reverse(),
      months: Object.keys(monthMap).sort().reverse(),
      years: Object.keys(yearMap).sort().reverse(),
    }
  }, [reports])

  const dailyData = useMemo(() => reports[selectedDailyIdx] ? calcDaily(reports[selectedDailyIdx]) : null, [reports, selectedDailyIdx])
  const prevDailyData = useMemo(() => reports[selectedDailyIdx + 1] ? calcDaily(reports[selectedDailyIdx + 1]) : null, [reports, selectedDailyIdx])
  const weeklyData = useMemo(() => {
    const key = selectedWeekKey || availablePeriods.weeks[0]
    const slice = availablePeriods.weekMap[key] || []
    return slice.length && aggregates?.calcPeriod ? aggregates.calcPeriod(slice) : null
  }, [availablePeriods, selectedWeekKey, aggregates])
  const monthlyData = useMemo(() => {
    const key = selectedMonthKey || availablePeriods.months[0]
    const slice = availablePeriods.monthMap[key] || []
    return slice.length && aggregates?.calcPeriod ? aggregates.calcPeriod(slice) : null
  }, [availablePeriods, selectedMonthKey, aggregates])
  const yearlyData = useMemo(() => {
    const key = selectedYearKey || availablePeriods.years[0]
    const slice = availablePeriods.yearMap[key] || []
    return slice.length && aggregates?.calcPeriod ? aggregates.calcPeriod(slice) : null
  }, [availablePeriods, selectedYearKey, aggregates])

  if (loading) return <div className={styles.container}><div className={styles.emptyState}>Ładowanie raportów systemowych...</div></div>

  const renderSummary = (data, prevData = null) => {
    if (!data) return null
    
    const getTrend = (curr, prev) => {
        if (!prev) return null
        const diff = ((curr - prev) / prev) * 100
        return (
            <span className={diff >= 0 ? styles.positive : styles.negative}>
                {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}%
            </span>
        )
    }

    const realTotal = data.realizationTotal ?? data.avgRealizacjaTotal ?? 0
    const realC1    = data.realizationC1 ?? data.avgRealizacjaC1 ?? 0
    const realC2    = data.realizationC2 ?? data.avgRealizacjaC2 ?? 0

    return (
      <div className={styles.summaryCards}>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Przychody</span>
          <span className={styles.sumValue}>{Math.round(data.revenue).toLocaleString()} PLN</span>
          <div className={styles.sumDetails}>
            <div className={styles.sumDetailItem}>
                <span className={styles.sumDetailLabel}>1kl:</span>
                <span className={styles.sumDetailValue}>{Math.round(data.revenueC1 || 0).toLocaleString()} PLN</span>
            </div>
            <div className={styles.sumDetailItem}>
                <span className={styles.sumDetailLabel}>2kl:</span>
                <span className={styles.sumDetailValue}>{Math.round(data.revenueC2 || 0).toLocaleString()} PLN</span>
            </div>
          </div>
          {prevData && <div className={styles.sumTrend}>{getTrend(data.revenue, prevData.revenue)} vs poprz.</div>}
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Koszty</span>
          <span className={styles.sumValue} style={{color: '#f0a040'}}>{Math.round(data.cost).toLocaleString()} PLN</span>
          {prevData && <div className={styles.sumTrend}>{getTrend(data.cost, prevData.cost)} vs poprz.</div>}
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Przewiezione</span>
          <span className={styles.sumValue}>{Math.round(data.transferred).toLocaleString()} os.</span>
          <div className={styles.sumDetails}>
            <div className={styles.sumDetailItem}>
                <span className={styles.sumDetailLabel}>1kl:</span>
                <span className={styles.sumDetailValue}>{Math.round(data.transferredC1).toLocaleString()}</span>
            </div>
            <div className={styles.sumDetailItem}>
                <span className={styles.sumDetailLabel}>2kl:</span>
                <span className={styles.sumDetailValue}>{Math.round(data.transferredC2).toLocaleString()}</span>
            </div>
          </div>
          {prevData && <div className={styles.sumTrend}>{getTrend(data.transferred, prevData.transferred)} vs poprz.</div>}
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Śr. Realizacja</span>
          <span className={styles.sumValue}>
            {(realTotal * 100).toFixed(1)}%
          </span>
          <div className={styles.sumDetails}>
            <div className={styles.sumDetailItem}>
                <span className={styles.sumDetailLabel}>1kl:</span>
                <span className={styles.sumDetailValue}>{(realC1 * 100).toFixed(1)}%</span>
            </div>
            <div className={styles.sumDetailItem}>
                <span className={styles.sumDetailLabel}>2kl:</span>
                <span className={styles.sumDetailValue}>{(realC2 * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Wynik netto</span>
          <span className={styles.sumValue} style={{color: data.netto >= 0 ? '#4caf50' : '#e74c3c'}}>
            {data.netto >= 0 ? '+' : ''}{Math.round(data.netto).toLocaleString()} PLN
          </span>
          {prevData && <div className={styles.sumTrend}>{getTrend(data.netto, prevData.netto)} vs poprz.</div>}
        </div>
      </div>
    )
  }

  const renderClassInfo = (v1, v2, unit = '', isPercent = false) => (
    <div className={styles.classInfo}>
      <div className={styles.classItem}>
        <span className={styles.classLabel}>1kl:</span>
        <span className={styles.classValue}>{isPercent ? (v1 * 100).toFixed(1) + '%' : Math.round(v1).toLocaleString() + unit}</span>
      </div>
      <div className={styles.classItem}>
        <span className={styles.classLabel}>2kl:</span>
        <span className={styles.classValue}>{isPercent ? (v2 * 100).toFixed(1) + '%' : Math.round(v2).toLocaleString() + unit}</span>
      </div>
    </div>
  )

  const renderDailyTable = () => {
    const latest = reports[selectedDailyIdx]
    if (!latest?.trainSets) return <div className={styles.emptyState}>Brak szczegółowych danych dla wybranego dnia.</div>

    return (
      <div className={styles.contentWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Skład</th>
              <th>Przychód</th>
              <th>Koszty</th>
              <th>Wynik netto</th>
              <th>Km</th>
              <th>Pasażerowie</th>
              <th>Realizacja</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(latest.trainSets).map(([id, ts]) => {
              const td1 = ts.daily?.totalDemand?.class1 || 0
              const tr1 = ts.daily?.transferred?.class1 || 0
              const td2 = ts.daily?.totalDemand?.class2 || 0
              const tr2 = ts.daily?.transferred?.class2 || 0
              const realC1 = ts.daily?.realizacjaC1 ?? (td1 > 0 ? tr1 / td1 : 0)
              const realC2 = ts.daily?.realizacjaC2 ?? (td2 > 0 ? tr2 / td2 : 0)

              return (
              <Fragment key={id}>
                <tr 
                  onClick={() => setExpandedTS(expandedTS === id ? null : id)}
                  style={{cursor: 'pointer'}}
                  className={expandedTS === id ? styles.activeRow : ''}
                >
                  <td style={{fontWeight: 'bold', color: '#fff'}}>
                    {expandedTS === id ? '▼' : '▶'} {ts.name}
                  </td>
                  <td>
                    {Math.round(ts.daily.przychod).toLocaleString()} PLN
                    {renderClassInfo(ts.daily.przychodC1 || 0, ts.daily.przychodC2 || 0, ' PLN')}
                  </td>
                  <td style={{color: '#f0a040'}}>{Math.round(ts.daily.koszt).toLocaleString()} PLN</td>
                  <td style={{fontWeight: 'bold', color: ts.daily.netto >= 0 ? '#4caf50' : '#e74c3c'}}>
                      {ts.daily.netto >= 0 ? '+' : ''}{Math.round(ts.daily.netto).toLocaleString()} PLN
                  </td>
                  <td>{ts.daily.km.toLocaleString()} km</td>
                  <td>
                    {ts.daily.transferred.total.toLocaleString()} os.
                    {renderClassInfo(ts.daily.transferred.class1, ts.daily.transferred.class2)}
                  </td>
                  <td>
                    {(ts.daily.realizacja * 100).toFixed(1)}%
                    {renderClassInfo(realC1, realC2, '', true)}
                  </td>
                </tr>
                {expandedTS === id && ts.kursy && (
                  Object.entries(ts.kursy).map(([kId, k]) => (
                    <tr key={kId} style={{background: 'rgba(0,0,0,0.55)', fontSize: '0.9em'}}>
                      <td style={{paddingLeft: 30, color: '#8aab8a'}}>
                        <span style={{color: '#f0c040'}}>{k.odjazd}</span> {k.from} → {k.to}
                      </td>
                      <td>
                        {k.przychod.toLocaleString()} PLN
                        {renderClassInfo(k.przychodC1 || 0, k.przychodC2 || 0, ' PLN')}
                      </td>
                      <td style={{color: '#8a4a2a'}}>{k.koszt.toLocaleString()} PLN</td>
                      <td style={{color: k.netto >= 0 ? '#4c8f4c' : '#a74c3c'}}>{k.netto.toLocaleString()} PLN</td>
                      <td>{k.km} km</td>
                      <td>
                        {k.transferred.total} os.
                        {renderClassInfo(k.transferred.class1, k.transferred.class2)}
                      </td>
                      <td>
                        {(k.realizacja * 100).toFixed(1)}%
                        {renderClassInfo(k.realizacjaC1 || 0, k.realizacjaC2 || 0, '', true)}
                      </td>
                    </tr>
                  ))
                )}
              </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderPeriodTable = (agg) => {
    if (!agg?.byTrainSet || Object.keys(agg.byTrainSet).length === 0) return null

    return (
      <div className={styles.contentWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Skład</th>
              <th>Dni kursowania</th>
              <th>Przychód łaczny</th>
              <th>Koszty łączne</th>
              <th>Wynik netto</th>
              <th>Km suma</th>
              <th>Pas. suma</th>
              <th>Śr. realizacja</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(agg.byTrainSet)
              .sort(([,a], [,b]) => b.revenue - a.revenue)
              .map(([id, tsb]) => (
              <Fragment key={id}>
                <tr 
                  onClick={() => setExpandedTS(expandedTS === id ? null : id)}
                  style={{cursor: 'pointer'}}
                  className={expandedTS === id ? styles.activeRow : ''}
                >
                  <td style={{fontWeight: 'bold', color: '#fff'}}>
                    {expandedTS === id ? '▼' : '▶'} {tsb.name}
                  </td>
                  <td style={{textAlign: 'center', color: '#4fc3f7'}}>{tsb.daysActive}</td>
                  <td>
                    {Math.round(tsb.revenue).toLocaleString()} PLN
                    {renderClassInfo(tsb.revenueC1, tsb.revenueC2, ' PLN')}
                  </td>
                  <td style={{color: '#f0a040'}}>{Math.round(tsb.cost).toLocaleString()} PLN</td>
                  <td style={{fontWeight: 'bold', color: tsb.netto >= 0 ? '#4caf50' : '#e74c3c'}}>
                      {tsb.netto >= 0 ? '+' : ''}{Math.round(tsb.netto).toLocaleString()} PLN
                  </td>
                  <td>{Math.round(tsb.km).toLocaleString()} km</td>
                  <td>
                    {Math.round(tsb.transferred).toLocaleString()} os.
                    {renderClassInfo(tsb.transferredC1, tsb.transferredC2)}
                  </td>
                  <td>
                    {(tsb.avgRealizacja * 100).toFixed(1)}%
                    {renderClassInfo(tsb.avgRealizacjaC1, tsb.avgRealizacjaC2, '', true)}
                  </td>
                </tr>
                {expandedTS === id && tsb.kursy && (
                  Object.entries(tsb.kursy)
                    .sort(([,a], [,b]) => a.odjazd.localeCompare(b.odjazd))
                    .map(([kId, kb]) => (
                    <tr key={kId} style={{background: 'rgba(0,0,0,0.55)', fontSize: '0.9em'}}>
                      <td style={{paddingLeft: 30, color: '#8aab8a'}}>
                        <span style={{color: '#f0c040'}}>{kb.odjazd}</span> {kb.from} → {kb.to}
                      </td>
                      <td style={{textAlign: 'center', color: '#6a8a6a', fontSize: '0.8em'}}>Suma:</td>
                      <td>
                        {Math.round(kb.przychod).toLocaleString()} PLN
                        {renderClassInfo(kb.przychodC1 || 0, kb.przychodC2 || 0, ' PLN')}
                      </td>
                      <td style={{color: '#8a4a2a'}}>{Math.round(kb.koszt).toLocaleString()} PLN</td>
                      <td style={{color: kb.netto >= 0 ? '#4c8f4c' : '#a74c3c'}}>{Math.round(kb.netto).toLocaleString()} PLN</td>
                      <td>{Math.round(kb.km).toLocaleString()} km</td>
                      <td>
                        {Math.round(kb.transferredTotal).toLocaleString()} os.
                        {renderClassInfo(kb.transferredC1 || 0, kb.transferredC2 || 0)}
                      </td>
                      <td>
                        {(kb.avgRealizacja * 100).toFixed(1)}%
                        {renderClassInfo(kb.avgRealizacjaC1 || 0, kb.avgRealizacjaC2 || 0, '', true)}
                      </td>
                    </tr>
                  ))
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderTrends = () => {
    if (!aggregates?.trendData?.length) return null

    const BAR_WIDTH = 28
    const MONTH_NAMES = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

    const availableMonths = [...new Set(
      aggregates.trendData.map(d => d.date?.slice(0, 7)).filter(Boolean)
    )].sort().reverse()
    const availableYears = [...new Set(
      aggregates.trendData.map(d => d.date?.slice(0, 4)).filter(Boolean)
    )].sort().reverse()

    const toggleStyle = (active) => ({
      background: active ? '#2a4a2a' : 'transparent',
      color: active ? '#f0c040' : '#8aab8a',
      border: 'none', padding: '4px 12px', borderRadius: 3, cursor: 'pointer', fontSize: 12
    })

    const selectStyle = {background: '#0d1a0d', color: '#f0c040', border: '1px solid #2a4a2a', borderRadius: 4, padding: '4px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}
    const labelStyle = {color: '#8aab8a', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}

    // Single-value bar chart
    const renderSimpleChart = (entries, getValue, getLabel, title, color, unit = '') => {
      const vals = entries.map(e => getValue(e)).filter(v => v !== undefined)
      const maxVal = Math.max(...vals, 1)
      return (
        <>
          <div style={{marginBottom: 6, marginTop: 32, color, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 1}}>{title}</div>
          <div style={{height: 160, display: 'flex', alignItems: 'flex-end', gap: 2, paddingBottom: 24, overflowX: 'auto'}}>
            {entries.map((e, i) => {
              const val = getValue(e)
              const hasData = val !== undefined
              const lbl = getLabel(e)
              return (
                <div key={i} style={{width: BAR_WIDTH, minWidth: BAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative'}}>
                  <div style={{height: hasData ? `${(val / maxVal) * 100}%` : 4, minHeight: 4, background: hasData ? color : '#1a2a1a', borderRadius: '4px 4px 0 0', opacity: hasData ? 1 : 0.3}}
                    title={hasData ? `${lbl}: ${val.toLocaleString()}${unit}` : `${lbl}: brak danych`} />
                  <span style={{position: 'absolute', bottom: -20, left: 0, width: BAR_WIDTH, textAlign: 'center', fontSize: 9, color: hasData ? '#8aab8a' : '#3a5a3a', whiteSpace: 'nowrap'}}>{lbl}</span>
                </div>
              )
            })}
          </div>
        </>
      )
    }

    // Stacked 2-segment bar chart (bottom = v2, top = v1)
    const renderStackedChart = (entries, getV1, getV2, getLabel, title, color1, color2) => {
      const totals = entries.map(e => {
        const v1 = getV1(e), v2 = getV2(e)
        return (v1 !== undefined || v2 !== undefined) ? (v1 || 0) + (v2 || 0) : undefined
      })
      const maxVal = Math.max(...totals.filter(v => v !== undefined), 1)
      return (
        <>
          <div style={{marginBottom: 6, marginTop: 32, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 1}}>
            <span style={{color: title === 'PASAŻEROWIE' ? '#c0d0c0' : '#c0d0c0'}}>{title}</span>
            <span style={{marginLeft: 12, color: color1}}>■ 1kl</span>
            <span style={{marginLeft: 8, color: color2}}>■ 2kl</span>
          </div>
          <div style={{height: 160, display: 'flex', alignItems: 'flex-end', gap: 2, paddingBottom: 24, overflowX: 'auto'}}>
            {entries.map((e, i) => {
              const v1 = getV1(e) || 0
              const v2 = getV2(e) || 0
              const total = v1 + v2
              const hasData = getV1(e) !== undefined || getV2(e) !== undefined
              const lbl = getLabel(e)
              const h1pct = maxVal > 0 ? (v1 / maxVal) * 100 : 0
              const h2pct = maxVal > 0 ? (v2 / maxVal) * 100 : 0
              return (
                <div key={i} style={{width: BAR_WIDTH, minWidth: BAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative'}}>
                  {hasData ? (
                    <div style={{display: 'flex', flexDirection: 'column', height: `${h1pct + h2pct}%`, minHeight: 4, borderRadius: '4px 4px 0 0', overflow: 'hidden'}}
                      title={`${lbl}: ${total.toLocaleString()} (1kl: ${v1.toLocaleString()}, 2kl: ${v2.toLocaleString()})`}>
                      <div style={{flex: h1pct, background: color1, minHeight: h1pct > 0 ? 2 : 0}} />
                      <div style={{flex: h2pct, background: color2, minHeight: h2pct > 0 ? 2 : 0}} />
                    </div>
                  ) : (
                    <div style={{height: 4, background: '#1a2a1a', borderRadius: '4px 4px 0 0', opacity: 0.3}} />
                  )}
                  <span style={{position: 'absolute', bottom: -20, left: 0, width: BAR_WIDTH, textAlign: 'center', fontSize: 9, color: hasData ? '#8aab8a' : '#3a5a3a', whiteSpace: 'nowrap'}}>{lbl}</span>
                </div>
              )
            })}
          </div>
        </>
      )
    }

    // Revenue + netto charts
    const renderFinanceCharts = (entries, getRev, getNet, getLabel) => {
      const revVals = entries.map(e => getRev(e)).filter(v => v !== undefined)
      const netVals = entries.map(e => getNet(e)).filter(v => v !== undefined)
      const maxRev = Math.max(...revVals, 1)
      const maxNet = Math.max(...netVals.map(Math.abs), 1)
      return (
        <>
          <div style={{marginBottom: 6, color: '#4caf50', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 1}}>PRZYCHODY</div>
          <div style={{height: 200, display: 'flex', alignItems: 'flex-end', gap: 2, paddingBottom: 24, overflowX: 'auto', marginBottom: 32}}>
            {entries.map((e, i) => {
              const rev = getRev(e)
              const hasData = rev !== undefined
              const lbl = getLabel(e)
              return (
                <div key={i} style={{width: BAR_WIDTH, minWidth: BAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative'}}>
                  <div style={{height: hasData ? `${(rev / maxRev) * 100}%` : 4, minHeight: 4, background: hasData ? 'linear-gradient(to top, #2a4a2a, #4caf50)' : '#1a2a1a', borderRadius: '4px 4px 0 0', opacity: hasData ? 1 : 0.3}}
                    title={hasData ? `${lbl}: ${rev.toLocaleString()} PLN` : `${lbl}: brak danych`} />
                  <span style={{position: 'absolute', bottom: -20, left: 0, width: BAR_WIDTH, textAlign: 'center', fontSize: 9, color: hasData ? '#8aab8a' : '#3a5a3a', whiteSpace: 'nowrap'}}>{lbl}</span>
                </div>
              )
            })}
          </div>
          <div style={{marginBottom: 6, color: '#4fc3f7', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 1}}>ZYSK NETTO</div>
          <div style={{height: 200, display: 'flex', alignItems: 'flex-end', gap: 2, paddingBottom: 24, overflowX: 'auto'}}>
            {entries.map((e, i) => {
              const net = getNet(e)
              const hasData = net !== undefined
              const lbl = getLabel(e)
              const bg = !hasData ? '#1a2a1a' : net < 0 ? 'linear-gradient(to top, #4a0a0a, #e74c3c)' : 'linear-gradient(to top, #0a2a3a, #4fc3f7)'
              return (
                <div key={i} style={{width: BAR_WIDTH, minWidth: BAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative'}}>
                  <div style={{height: hasData ? `${(Math.abs(net) / maxNet) * 100}%` : 4, minHeight: 4, background: bg, borderRadius: '4px 4px 0 0', opacity: hasData ? 1 : 0.3}}
                    title={hasData ? `${lbl}: ${net.toLocaleString()} PLN` : `${lbl}: brak danych`} />
                  <span style={{position: 'absolute', bottom: -20, left: 0, width: BAR_WIDTH, textAlign: 'center', fontSize: 9, color: hasData ? '#8aab8a' : '#3a5a3a', whiteSpace: 'nowrap'}}>{lbl}</span>
                </div>
              )
            })}
          </div>
        </>
      )
    }

    if (trendView === 'monthly') {
      const month = selectedTrendMonth || availableMonths[0]
      if (!month) return null
      const [year, mon] = month.split('-').map(Number)
      const daysInMonth = new Date(year, mon, 0).getDate()
      const dm = {}
      aggregates.trendData.forEach(d => {
        if (d.date?.startsWith(month)) {
          const day = parseInt(d.date.slice(8))
          dm[day] = d
        }
      })
      const days = Array.from({length: daysInMonth}, (_, i) => i + 1)

      return (
        <div className={styles.contentWrapper}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20}}>
            <div style={{display: 'flex', background: 'rgba(10,21,10,0.65)', border: '1px solid #2a4a2a', borderRadius: 4, padding: 2}}>
              <button onClick={() => setTrendView('monthly')} style={toggleStyle(true)}>Po dniach</button>
              <button onClick={() => setTrendView('yearly')} style={toggleStyle(false)}>Po miesiącach</button>
            </div>
            <span style={labelStyle}>Miesiąc:</span>
            <select value={month} onChange={e => setSelectedTrendMonth(e.target.value)} style={selectStyle}>
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{color: '#6a8a6a', fontSize: 12, fontFamily: "'Share Tech Mono', monospace"}}>
              {Object.keys(dm).length} / {daysInMonth} dni z danymi
            </span>
          </div>
          {renderFinanceCharts(days, d => dm[d]?.revenue, d => dm[d]?.netto, d => String(d))}
          {renderStackedChart(days, d => dm[d]?.transferredC1, d => dm[d]?.transferredC2, d => String(d), 'PASAŻEROWIE', '#4fc3f7', '#f0a040')}
          {renderStackedChart(days, d => dm[d]?.wagonCount || (dm[d] ? 0 : undefined), d => dm[d]?.locoCount || (dm[d] ? 0 : undefined), d => String(d), 'TABOR', '#a0c060', '#f0c040')}
          {renderSimpleChart(days, d => dm[d]?.km, d => String(d), 'KILOMETRY', 'linear-gradient(to top, #4a2a6a, #9b59b6)', ' km')}
        </div>
      )
    }

    // Yearly view
    const year = selectedTrendYear || availableYears[0]
    if (!year) return null
    const monthAgg = {}
    aggregates.trendData.forEach(d => {
      if (d.date?.startsWith(year)) {
        const m = parseInt(d.date.slice(5, 7))
        if (!monthAgg[m]) monthAgg[m] = { revenue: 0, netto: 0, transferredC1: 0, transferredC2: 0, km: 0, wagonCount: 0, locoCount: 0 }
        monthAgg[m].revenue += d.revenue
        monthAgg[m].netto += d.netto
        monthAgg[m].transferredC1 += d.transferredC1 || 0
        monthAgg[m].transferredC2 += d.transferredC2 || 0
        monthAgg[m].km += d.km || 0
        monthAgg[m].wagonCount += d.wagonCount || 0
        monthAgg[m].locoCount += d.locoCount || 0
      }
    })
    const months12 = Array.from({length: 12}, (_, i) => i + 1)

    return (
      <div className={styles.contentWrapper}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20}}>
          <div style={{display: 'flex', background: 'rgba(10,21,10,0.65)', border: '1px solid #2a4a2a', borderRadius: 4, padding: 2}}>
            <button onClick={() => setTrendView('monthly')} style={toggleStyle(false)}>Po dniach</button>
            <button onClick={() => setTrendView('yearly')} style={toggleStyle(true)}>Po miesiącach</button>
          </div>
          <span style={labelStyle}>Rok:</span>
          <select value={year} onChange={e => setSelectedTrendYear(e.target.value)} style={selectStyle}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{color: '#6a8a6a', fontSize: 12, fontFamily: "'Share Tech Mono', monospace"}}>
            {Object.keys(monthAgg).length} / 12 miesięcy z danymi
          </span>
        </div>
        {renderFinanceCharts(months12, m => monthAgg[m]?.revenue, m => monthAgg[m]?.netto, m => MONTH_NAMES[m - 1])}
        {renderStackedChart(months12, m => monthAgg[m]?.transferredC1, m => monthAgg[m]?.transferredC2, m => MONTH_NAMES[m - 1], 'PASAŻEROWIE', '#4fc3f7', '#f0a040')}
        {renderStackedChart(months12, m => monthAgg[m]?.wagonCount || (monthAgg[m] ? 0 : undefined), m => monthAgg[m]?.locoCount || (monthAgg[m] ? 0 : undefined), m => MONTH_NAMES[m - 1], 'TABOR', '#a0c060', '#f0c040')}
        {renderSimpleChart(months12, m => monthAgg[m]?.km, m => MONTH_NAMES[m - 1], 'KILOMETRY', 'linear-gradient(to top, #4a2a6a, #9b59b6)', ' km')}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2 style={{background: 'rgba(6,15,6,0.75)', display: 'inline-block', padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(42,74,42,0.4)'}}>Raporty i Analizy</h2>
          <p style={{color: '#8aab8a', margin: '4px 0 0 0', background: 'rgba(6,15,6,0.75)', display: 'inline-block', padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(42,74,42,0.4)'}}>Wyniki finansowe i operacyjne twojej floty</p>
        </div>
        
        <nav className={styles.tabNav}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'daily' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('daily')}
          >Dzienne</button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'weekly' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('weekly')}
          >Tygodniowe</button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'monthly' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('monthly')}
          >Miesięczne</button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'yearly' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('yearly')}
          >Roczne</button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'trends' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('trends')}
          >Trend</button>
        </nav>
      </header>

      {activeTab === 'daily' && (
        <section className={styles.section}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4}}>
            <h3 style={{margin: 0, background: 'rgba(6,15,6,0.75)', display: 'inline-block', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(42,74,42,0.4)'}}>📊 Dane za dzień:</h3>
            <select
              value={selectedDailyIdx}
              onChange={e => { setSelectedDailyIdx(Number(e.target.value)); setExpandedTS(null) }}
              style={{background: '#0d1a0d', color: '#f0c040', border: '1px solid #2a4a2a', borderRadius: 4, padding: '4px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}}
            >
              {reports.map((r, i) => (
                <option key={r.date} value={i}>{coverageDate(r.date)}</option>
              ))}
            </select>
          </div>
          <p style={{color: '#8aab8a', fontSize: 12, margin: '0 0 20px 0', fontFamily: "'Share Tech Mono', monospace", background: 'rgba(6,15,6,0.75)', display: 'inline-block', padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(42,74,42,0.4)'}}>
            Raport wygenerowany o 03:00 dnia {reports[selectedDailyIdx]?.date || '—'} · dane sprzed resetu dobowego
          </p>
          {renderSummary(dailyData, prevDailyData)}
          <h3 style={{marginTop: 32, background: 'rgba(6,15,6,0.75)', display: 'inline-block', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(42,74,42,0.4)'}}>📋 Wyniki per pociąg</h3>
          {renderDailyTable()}
        </section>
      )}

      {activeTab === 'weekly' && (
        <section className={styles.section}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16}}>
            <h3 style={{margin: 0}}>📈 Tydzień:</h3>
            <select
              value={selectedWeekKey || availablePeriods.weeks[0] || ''}
              onChange={e => { setSelectedWeekKey(e.target.value); setExpandedTS(null) }}
              style={{background: '#0d1a0d', color: '#f0c040', border: '1px solid #2a4a2a', borderRadius: 4, padding: '4px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}}
            >
              {availablePeriods.weeks.map(wk => {
                const [yr, wn] = wk.split('-W')
                return <option key={wk} value={wk}>Tydzień {wn}, {yr} ({availablePeriods.weekMap[wk].length} dni)</option>
              })}
            </select>
          </div>
          {renderSummary(weeklyData)}
          <h3 style={{marginTop: 32}}>📋 Wyniki składów (tydzień)</h3>
          {renderPeriodTable(weeklyData)}
        </section>
      )}

      {activeTab === 'monthly' && (
        <section className={styles.section}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16}}>
            <h3 style={{margin: 0}}>📅 Miesiąc:</h3>
            <select
              value={selectedMonthKey || availablePeriods.months[0] || ''}
              onChange={e => { setSelectedMonthKey(e.target.value); setExpandedTS(null) }}
              style={{background: '#0d1a0d', color: '#f0c040', border: '1px solid #2a4a2a', borderRadius: 4, padding: '4px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}}
            >
              {availablePeriods.months.map(mo => {
                const [yr, mn] = mo.split('-')
                return <option key={mo} value={mo}>{MONTH_NAMES_PL[parseInt(mn) - 1]} {yr}</option>
              })}
            </select>
          </div>
          {renderSummary(monthlyData)}
          <h3 style={{marginTop: 32}}>📋 Wyniki składów (miesiąc)</h3>
          {renderPeriodTable(monthlyData)}
        </section>
      )}

      {activeTab === 'yearly' && (
        <section className={styles.section}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16}}>
            <h3 style={{margin: 0}}>📅 Rok:</h3>
            <select
              value={selectedYearKey || availablePeriods.years[0] || ''}
              onChange={e => { setSelectedYearKey(e.target.value); setExpandedTS(null) }}
              style={{background: '#0d1a0d', color: '#f0c040', border: '1px solid #2a4a2a', borderRadius: 4, padding: '4px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}}
            >
              {availablePeriods.years.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
          {renderSummary(yearlyData)}
        </section>
      )}

      {activeTab === 'trends' && (
        <section className={styles.section}>
          <h3>🔥 Trendy przychodów</h3>
          {renderTrends()}
        </section>
      )}

      {reports.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.noDataIcon}>📭</div>
          <p>Brak dostępnych raportów w bazie danych.</p>
          <p style={{fontSize: 14, opacity: 0.7}}>Raporty generowane są codziennie o godzinie 03:00.</p>
        </div>
      )}
    </div>
  )
}
