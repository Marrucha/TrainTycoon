import { Fragment } from 'react'
import styles from './ReportsMenu.module.css'

function ClassInfo({ v1, v2, unit = '', isPercent = false }) {
  return (
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
}

export function DailyTable({ report, expandedTS, setExpandedTS }) {
  if (!report?.trainSets) return <div className={styles.emptyState}>Brak szczegółowych danych dla wybranego dnia.</div>

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
          {Object.entries(report.trainSets).map(([id, ts]) => {
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
                    <ClassInfo v1={ts.daily.przychodC1 || 0} v2={ts.daily.przychodC2 || 0} unit=" PLN" />
                  </td>
                  <td style={{color: '#f0a040'}}>{Math.round(ts.daily.koszt).toLocaleString()} PLN</td>
                  <td style={{fontWeight: 'bold', color: ts.daily.netto >= 0 ? '#4caf50' : '#e74c3c'}}>
                    {ts.daily.netto >= 0 ? '+' : ''}{Math.round(ts.daily.netto).toLocaleString()} PLN
                  </td>
                  <td>{ts.daily.km.toLocaleString()} km</td>
                  <td>
                    {ts.daily.transferred.total.toLocaleString()} os.
                    <ClassInfo v1={ts.daily.transferred.class1} v2={ts.daily.transferred.class2} />
                  </td>
                  <td>
                    {(ts.daily.realizacja * 100).toFixed(1)}%
                    <ClassInfo v1={realC1} v2={realC2} isPercent />
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
                        <ClassInfo v1={k.przychodC1 || 0} v2={k.przychodC2 || 0} unit=" PLN" />
                      </td>
                      <td style={{color: '#8a4a2a'}}>{k.koszt.toLocaleString()} PLN</td>
                      <td style={{color: k.netto >= 0 ? '#4c8f4c' : '#a74c3c'}}>{k.netto.toLocaleString()} PLN</td>
                      <td>{k.km} km</td>
                      <td>
                        {k.transferred.total} os.
                        <ClassInfo v1={k.transferred.class1} v2={k.transferred.class2} />
                      </td>
                      <td>
                        {(k.realizacja * 100).toFixed(1)}%
                        <ClassInfo v1={k.realizacjaC1 || 0} v2={k.realizacjaC2 || 0} isPercent />
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

export function PeriodTable({ agg, expandedTS, setExpandedTS }) {
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
                  <ClassInfo v1={tsb.revenueC1} v2={tsb.revenueC2} unit=" PLN" />
                </td>
                <td style={{color: '#f0a040'}}>{Math.round(tsb.cost).toLocaleString()} PLN</td>
                <td style={{fontWeight: 'bold', color: tsb.netto >= 0 ? '#4caf50' : '#e74c3c'}}>
                  {tsb.netto >= 0 ? '+' : ''}{Math.round(tsb.netto).toLocaleString()} PLN
                </td>
                <td>{Math.round(tsb.km).toLocaleString()} km</td>
                <td>
                  {Math.round(tsb.transferred).toLocaleString()} os.
                  <ClassInfo v1={tsb.transferredC1} v2={tsb.transferredC2} />
                </td>
                <td>
                  {(tsb.avgRealizacja * 100).toFixed(1)}%
                  <ClassInfo v1={tsb.avgRealizacjaC1} v2={tsb.avgRealizacjaC2} isPercent />
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
                      <ClassInfo v1={kb.przychodC1 || 0} v2={kb.przychodC2 || 0} unit=" PLN" />
                    </td>
                    <td style={{color: '#8a4a2a'}}>{Math.round(kb.koszt).toLocaleString()} PLN</td>
                    <td style={{color: kb.netto >= 0 ? '#4c8f4c' : '#a74c3c'}}>{Math.round(kb.netto).toLocaleString()} PLN</td>
                    <td>{Math.round(kb.km).toLocaleString()} km</td>
                    <td>
                      {Math.round(kb.transferredTotal).toLocaleString()} os.
                      <ClassInfo v1={kb.transferredC1 || 0} v2={kb.transferredC2 || 0} />
                    </td>
                    <td>
                      {(kb.avgRealizacja * 100).toFixed(1)}%
                      <ClassInfo v1={kb.avgRealizacjaC1 || 0} v2={kb.avgRealizacjaC2 || 0} isPercent />
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
