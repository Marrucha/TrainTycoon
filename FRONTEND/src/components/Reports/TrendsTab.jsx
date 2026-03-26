import styles from './ReportsMenu.module.css'

const BAR_WIDTH = 28
const MONTH_NAMES = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

const toggleStyle = (active) => ({
  background: active ? '#2a4a2a' : 'transparent',
  color: active ? '#f0c040' : '#8aab8a',
  border: 'none', padding: '4px 12px', borderRadius: 3, cursor: 'pointer', fontSize: 12
})

const selectStyle = {background: '#0d1a0d', color: '#f0c040', border: '1px solid #2a4a2a', borderRadius: 4, padding: '4px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}
const labelStyle = {color: '#8aab8a', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}

function SimpleChart({ entries, getValue, getLabel, title, color, unit = '' }) {
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

function StackedChart({ entries, getV1, getV2, getLabel, title, color1, color2 }) {
  const totals = entries.map(e => {
    const v1 = getV1(e), v2 = getV2(e)
    return (v1 !== undefined || v2 !== undefined) ? (v1 || 0) + (v2 || 0) : undefined
  })
  const maxVal = Math.max(...totals.filter(v => v !== undefined), 1)
  return (
    <>
      <div style={{marginBottom: 6, marginTop: 32, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 1}}>
        <span style={{color: '#c0d0c0'}}>{title}</span>
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

function FinanceCharts({ entries, getRev, getNet, getLabel }) {
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

export default function TrendsTab({ aggregates, trendView, setTrendView, selectedTrendMonth, setSelectedTrendMonth, selectedTrendYear, setSelectedTrendYear }) {
  if (!aggregates?.trendData?.length) return null

  const availableMonths = [...new Set(
    aggregates.trendData.map(d => d.date?.slice(0, 7)).filter(Boolean)
  )].sort().reverse()
  const availableYears = [...new Set(
    aggregates.trendData.map(d => d.date?.slice(0, 4)).filter(Boolean)
  )].sort().reverse()

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
        <FinanceCharts entries={days} getRev={d => dm[d]?.revenue} getNet={d => dm[d]?.netto} getLabel={d => String(d)} />
        <StackedChart entries={days} getV1={d => dm[d]?.transferredC1} getV2={d => dm[d]?.transferredC2} getLabel={d => String(d)} title="PASAŻEROWIE" color1="#4fc3f7" color2="#f0a040" />
        <StackedChart entries={days} getV1={d => dm[d]?.wagonCount || (dm[d] ? 0 : undefined)} getV2={d => dm[d]?.locoCount || (dm[d] ? 0 : undefined)} getLabel={d => String(d)} title="TABOR" color1="#a0c060" color2="#f0c040" />
        <SimpleChart entries={days} getValue={d => dm[d]?.km} getLabel={d => String(d)} title="KILOMETRY" color="linear-gradient(to top, #4a2a6a, #9b59b6)" unit=" km" />
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
      <FinanceCharts entries={months12} getRev={m => monthAgg[m]?.revenue} getNet={m => monthAgg[m]?.netto} getLabel={m => MONTH_NAMES[m - 1]} />
      <StackedChart entries={months12} getV1={m => monthAgg[m]?.transferredC1} getV2={m => monthAgg[m]?.transferredC2} getLabel={m => MONTH_NAMES[m - 1]} title="PASAŻEROWIE" color1="#4fc3f7" color2="#f0a040" />
      <StackedChart entries={months12} getV1={m => monthAgg[m]?.wagonCount || (monthAgg[m] ? 0 : undefined)} getV2={m => monthAgg[m]?.locoCount || (monthAgg[m] ? 0 : undefined)} getLabel={m => MONTH_NAMES[m - 1]} title="TABOR" color1="#a0c060" color2="#f0c040" />
      <SimpleChart entries={months12} getValue={m => monthAgg[m]?.km} getLabel={m => MONTH_NAMES[m - 1]} title="KILOMETRY" color="linear-gradient(to top, #4a2a6a, #9b59b6)" unit=" km" />
    </div>
  )
}
