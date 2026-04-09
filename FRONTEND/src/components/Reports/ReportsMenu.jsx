import { useState } from 'react'
import styles from './ReportsMenu.module.css'
import cmStyles from '../CompanyMenu/CompanyMenu.module.css'
import { useGame } from '../../context/GameContext'
import { useReportsData, coverageDate, MONTH_NAMES_PL } from './useReportsData'
import { DailyTable, PeriodTable } from './TrainSetTable'
import TrendsTab from './TrendsTab'

export default function ReportsMenu() {
  const { employees, gameConstants } = useGame()
  const _SALARIES = gameConstants?.SALARIES ?? { maszynista: 9000, kierownik: 7000, pomocnik: 6000, konduktor: 5000, barman: 4500 }
  const _INTERN_SALARY = gameConstants?.INTERN_SALARY ?? 4300
  const [activeTab, setActiveTab] = useState('daily')
  const [expandedTS, setExpandedTS] = useState(null)
  const [trendView, setTrendView] = useState('monthly')
  const [selectedTrendMonth, setSelectedTrendMonth] = useState(null)
  const [selectedTrendYear, setSelectedTrendYear] = useState(null)

  const {
    reports, loading, aggregates, availablePeriods,
    dailyData, prevDailyData, weeklyData, monthlyData, yearlyData,
    selectedDailyIdx, setSelectedDailyIdx,
    selectedWeekKey, setSelectedWeekKey,
    selectedMonthKey, setSelectedMonthKey,
    selectedYearKey, setSelectedYearKey,
  } = useReportsData()

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
            <div className={styles.sumDetailItem}><span className={styles.sumDetailLabel}>1kl:</span><span className={styles.sumDetailValue}>{Math.round(data.revenueC1 || 0).toLocaleString()} PLN</span></div>
            <div className={styles.sumDetailItem}><span className={styles.sumDetailLabel}>2kl:</span><span className={styles.sumDetailValue}>{Math.round(data.revenueC2 || 0).toLocaleString()} PLN</span></div>
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
            <div className={styles.sumDetailItem}><span className={styles.sumDetailLabel}>1kl:</span><span className={styles.sumDetailValue}>{Math.round(data.transferredC1).toLocaleString()}</span></div>
            <div className={styles.sumDetailItem}><span className={styles.sumDetailLabel}>2kl:</span><span className={styles.sumDetailValue}>{Math.round(data.transferredC2).toLocaleString()}</span></div>
          </div>
          {prevData && <div className={styles.sumTrend}>{getTrend(data.transferred, prevData.transferred)} vs poprz.</div>}
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Śr. Realizacja</span>
          <span className={styles.sumValue}>{(realTotal * 100).toFixed(1)}%</span>
          <div className={styles.sumDetails}>
            <div className={styles.sumDetailItem}><span className={styles.sumDetailLabel}>1kl:</span><span className={styles.sumDetailValue}>{(realC1 * 100).toFixed(1)}%</span></div>
            <div className={styles.sumDetailItem}><span className={styles.sumDetailLabel}>2kl:</span><span className={styles.sumDetailValue}>{(realC2 * 100).toFixed(1)}%</span></div>
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

  const renderSalaryBlock = (periodData) => {
    const total = (employees || []).reduce((sum, e) =>
      sum + (e.isIntern ? _INTERN_SALARY : (e.monthlySalary ?? _SALARIES[e.role] ?? 0)), 0)
    if (total === 0) return null

    const byRole = (employees || []).reduce((acc, e) => {
      const label = { maszynista: 'Maszyniści', kierownik: 'Kierownicy', pomocnik: 'Pomocnicy', konduktor: 'Konduktorzy', barman: 'Barmani' }[e.role] || e.role
      if (!acc[label]) acc[label] = { count: 0, total: 0 }
      acc[label].count += 1
      acc[label].total += e.isIntern ? _INTERN_SALARY : (e.monthlySalary ?? _SALARIES[e.role] ?? 0)
      return acc
    }, {})

    const nettoWithSalary = (periodData?.revenue ?? 0) - (periodData?.cost ?? 0) - total

    return (
      <div style={{ marginTop: 12, background: 'rgba(10,15,10,0.6)', border: '1px solid #2a3a2a', borderRadius: 8, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: '#8aab8a', fontSize: 12, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1, textTransform: 'uppercase' }}>Koszty zatrudnienia (miesięczne)</span>
          <span style={{ color: '#f0a040', fontWeight: 'bold', fontSize: 15, fontFamily: "'Share Tech Mono', monospace" }}>−{total.toLocaleString()} PLN</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.entries(byRole).map(([label, { count, total: t }]) => (
            <div key={label} style={{ fontSize: 11, color: '#6a8a6a', fontFamily: "'Share Tech Mono', monospace" }}>
              <span style={{ color: '#8aab8a' }}>{label}</span>
              <span style={{ color: '#555', marginLeft: 4 }}>({count}×)</span>
              <span style={{ color: '#f0a040', marginLeft: 4 }}>{t.toLocaleString()} PLN</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #1a2a1a', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6a8a6a', fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>Wynik netto z kosztami zatrudnienia:</span>
          <span style={{ fontWeight: 'bold', fontSize: 14, color: nettoWithSalary >= 0 ? '#4caf50' : '#e74c3c', fontFamily: "'Share Tech Mono', monospace" }}>
            {nettoWithSalary >= 0 ? '+' : ''}{Math.round(nettoWithSalary).toLocaleString()} PLN
          </span>
        </div>
      </div>
    )
  }

  const selectStyle = {background: '#0d1a0d', color: '#f0c040', border: '1px solid #2a4a2a', borderRadius: 4, padding: '4px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 13}

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={cmStyles.sectionHeader} style={{ marginBottom: 0 }}>
          <h2>Raporty operacyjne</h2>
          <p>Wyniki finansowe i operacyjne twojej floty.</p>
        </div>
        <nav className={styles.tabNav}>
          {['daily','weekly','monthly','yearly','trends'].map(tab => (
            <button key={tab}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab)}
            >{{ daily:'Dzienne', weekly:'Tygodniowe', monthly:'Miesięczne', yearly:'Roczne', trends:'Trend' }[tab]}</button>
          ))}
        </nav>
      </header>

      {activeTab === 'daily' && (
        <section className={styles.section}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4}}>
            <h3 style={{margin: 0, background: 'rgba(6,15,6,0.75)', display: 'inline-block', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(42,74,42,0.4)'}}>📊 Dane za dzień:</h3>
            <select value={selectedDailyIdx} onChange={e => { setSelectedDailyIdx(Number(e.target.value)); setExpandedTS(null) }} style={selectStyle}>
              {reports.map((r, i) => <option key={r.date} value={i}>{coverageDate(r.date)}</option>)}
            </select>
          </div>
          <p style={{color: '#8aab8a', fontSize: 12, margin: '0 0 20px 0', fontFamily: "'Share Tech Mono', monospace", background: 'rgba(6,15,6,0.75)', display: 'inline-block', padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(42,74,42,0.4)'}}>
            Raport wygenerowany o 03:00 dnia {reports[selectedDailyIdx]?.date || '—'} · dane sprzed resetu dobowego
          </p>
          {renderSummary(dailyData, prevDailyData)}
          <h3 style={{marginTop: 32, background: 'rgba(6,15,6,0.75)', display: 'inline-block', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(42,74,42,0.4)'}}>📋 Wyniki per pociąg</h3>
          <DailyTable report={reports[selectedDailyIdx]} expandedTS={expandedTS} setExpandedTS={setExpandedTS} />
        </section>
      )}

      {activeTab === 'weekly' && (
        <section className={styles.section}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16}}>
            <h3 style={{margin: 0}}>📈 Tydzień:</h3>
            <select value={selectedWeekKey || availablePeriods.weeks[0] || ''} onChange={e => { setSelectedWeekKey(e.target.value); setExpandedTS(null) }} style={selectStyle}>
              {availablePeriods.weeks.map(wk => {
                const [yr, wn] = wk.split('-W')
                return <option key={wk} value={wk}>Tydzień {wn}, {yr} ({availablePeriods.weekMap[wk].length} dni)</option>
              })}
            </select>
          </div>
          {renderSummary(weeklyData)}
          <h3 style={{marginTop: 32}}>📋 Wyniki składów (tydzień)</h3>
          <PeriodTable agg={weeklyData} expandedTS={expandedTS} setExpandedTS={setExpandedTS} />
        </section>
      )}

      {activeTab === 'monthly' && (
        <section className={styles.section}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16}}>
            <h3 style={{margin: 0}}>📅 Miesiąc:</h3>
            <select value={selectedMonthKey || availablePeriods.months[0] || ''} onChange={e => { setSelectedMonthKey(e.target.value); setExpandedTS(null) }} style={selectStyle}>
              {availablePeriods.months.map(mo => {
                const [yr, mn] = mo.split('-')
                return <option key={mo} value={mo}>{MONTH_NAMES_PL[parseInt(mn) - 1]} {yr}</option>
              })}
            </select>
          </div>
          {renderSummary(monthlyData)}
          {renderSalaryBlock(monthlyData)}
          <h3 style={{marginTop: 32}}>📋 Wyniki składów (miesiąc)</h3>
          <PeriodTable agg={monthlyData} expandedTS={expandedTS} setExpandedTS={setExpandedTS} />
        </section>
      )}

      {activeTab === 'yearly' && (
        <section className={styles.section}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16}}>
            <h3 style={{margin: 0}}>📆 Rok:</h3>
            <select value={selectedYearKey || availablePeriods.years[0] || ''} onChange={e => { setSelectedYearKey(e.target.value); setExpandedTS(null) }} style={selectStyle}>
              {availablePeriods.years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </div>
          {renderSummary(yearlyData)}
          <h3 style={{marginTop: 32}}>📋 Wyniki składów (rok)</h3>
          <PeriodTable agg={yearlyData} expandedTS={expandedTS} setExpandedTS={setExpandedTS} />
        </section>
      )}

      {activeTab === 'trends' && (
        <section className={styles.section}>
          <TrendsTab
            aggregates={aggregates}
            trendView={trendView}
            setTrendView={setTrendView}
            selectedTrendMonth={selectedTrendMonth}
            setSelectedTrendMonth={setSelectedTrendMonth}
            selectedTrendYear={selectedTrendYear}
            setSelectedTrendYear={setSelectedTrendYear}
          />
        </section>
      )}
    </div>
  )
}
