import { useState, useEffect, useMemo, Fragment } from 'react'
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import styles from './ReportsMenu.module.css'

export default function ReportsMenu() {
  const [activeTab, setActiveTab] = useState('daily') // daily, weekly, monthly, yearly, trends
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedTS, setExpandedTS] = useState(null)

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

  // Aggregates
  const aggregates = useMemo(() => {
    if (reports.length === 0) return null

    const latest = reports[0]
    const prev = reports[1]

    const calcDaily = (report) => {
      let revenue = 0
      let revenueC1 = 0
      let revenueC2 = 0
      let km = 0
      let transferred = 0
      let transferredC1 = 0
      let transferredC2 = 0
      let demandTotal = 0
      let demandC1 = 0
      let demandC2 = 0
      let cost = 0
      
      if (report?.trainSets) {
        Object.values(report.trainSets).forEach(ts => {
          const mainRev = ts.daily?.przychod || 0
          let c1r = ts.daily?.przychodC1 || 0
          let c2r = ts.daily?.przychodC2 || 0
          
          // Fallback: if class revenues are zero but total is not, estimate based on passengers
          if (mainRev > 0 && c1r === 0 && c2r === 0) {
            const t1 = ts.daily?.transferred?.class1 || 0
            const t2 = ts.daily?.transferred?.class2 || 0
            const totalT = t1 + t2
            if (totalT > 0) {
              // Assume 1st class tickets are ~1.6x more expensive (based on default 10/6 ratio)
              const weight1 = t1 * 1.6
              const weight2 = t2 * 1.0
              const totalW = weight1 + weight2
              c1r = (weight1 / totalW) * mainRev
              c2r = (weight2 / totalW) * mainRev
            }
          }

          revenue += mainRev
          revenueC1 += c1r
          revenueC2 += c2r
          
          km += ts.daily?.km || 0
          transferred += ts.daily?.transferred?.total || 0
          transferredC1 += ts.daily?.transferred?.class1 || 0
          transferredC2 += ts.daily?.transferred?.class2 || 0
          
          demandTotal += ts.daily?.totalDemand?.total || 0
          demandC1 += ts.daily?.totalDemand?.class1 || 0
          demandC2 += ts.daily?.totalDemand?.class2 || 0
          
          cost += ts.daily?.koszt || 0
        })
      }

      return { 
        revenue, revenueC1, revenueC2,
        km, cost, netto: revenue - cost,
        transferred, transferredC1, transferredC2,
        demandTotal, demandC1, demandC2,
        realizationTotal: demandTotal > 0 ? transferred / demandTotal : 0,
        realizationC1: demandC1 > 0 ? transferredC1 / demandC1 : 0,
        realizationC2: demandC2 > 0 ? transferredC2 / demandC2 : 0
      }
    }

    const currentDaily = calcDaily(latest)
    const prevDaily = prev ? calcDaily(prev) : null

    const calcPeriod = (count) => {
        const slice = reports.slice(0, count)
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

    return {
      daily: currentDaily,
      weekly: calcPeriod(7),
      monthly: calcPeriod(30),
      yearly: calcPeriod(365),
      trendData: [...reports].reverse().map(r => ({ date: r.date, ...calcDaily(r) }))
    }
  }, [reports])

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
    const latest = reports[0]
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
                    <tr key={kId} style={{background: 'rgba(0,0,0,0.2)', fontSize: '0.9em'}}>
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
                    <tr key={kId} style={{background: 'rgba(0,0,0,0.2)', fontSize: '0.9em'}}>
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
    const data = aggregates.trendData
    const maxRev = Math.max(...data.map(d => d.revenue)) || 1

    return (
      <div className={styles.contentWrapper}>
        <div style={{height: 300, display: 'flex', alignItems: 'flex-end', gap: 4, paddingBottom: 20}}>
          {data.map((d, i) => (
            <div 
              key={i} 
              style={{
                flex: 1, 
                height: `${(d.revenue / maxRev) * 100}%`,
                background: 'linear-gradient(to top, #2a4a2a, #4caf50)',
                borderRadius: '4px 4px 0 0',
                position: 'relative'
              }}
              title={`${d.date}: ${d.revenue.toLocaleString()} PLN`}
            >
                {i % 5 === 0 && (
                    <span style={{position: 'absolute', bottom: -20, left: 0, fontSize: 9, color: '#6a8a6a', whiteSpace: 'nowrap'}}>
                        {d.date.slice(5)}
                    </span>
                )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2>Raporty i Analizy</h2>
          <p style={{color: '#8aab8a', margin: '4px 0 0 0'}}>Wyniki finansowe i operacyjne twojej floty</p>
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
          <h3>📊 Podsumowanie dnia: {reports[0]?.date || 'Brak danych'}</h3>
          {renderSummary(aggregates?.daily, reports[1] ? aggregates.trendData[aggregates.trendData.length - 2] : null)}
          <h3 style={{marginTop: 32}}>📋 Wyniki per pociąg</h3>
          {renderDailyTable()}
        </section>
      )}

      {activeTab === 'weekly' && (
        <section className={styles.section}>
          <h3>📈 Ostatnie 7 dni</h3>
          {renderSummary(aggregates?.weekly)}
          <h3 style={{marginTop: 32}}>📋 Wyniki składów (tydzień)</h3>
          {renderPeriodTable(aggregates?.weekly)}
        </section>
      )}

      {activeTab === 'monthly' && (
        <section className={styles.section}>
          <h3>📅 Ostatnie 30 dni</h3>
          {renderSummary(aggregates?.monthly)}
          <h3 style={{marginTop: 32}}>📋 Wyniki składów (miesiąc)</h3>
          {renderPeriodTable(aggregates?.monthly)}
        </section>
      )}

      {activeTab === 'yearly' && (
        <section className={styles.section}>
          <h3>📅 Podsumowanie roczne</h3>
          {renderSummary(aggregates?.yearly)}
        </section>
      )}

      {activeTab === 'trends' && (
        <section className={styles.section}>
          <h3>🔥 Trendy przychodów (ostatnie 30 dni)</h3>
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
