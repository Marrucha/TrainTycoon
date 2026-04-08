import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db, auth } from '../../firebase/config'

export const MONTH_NAMES_PL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']

export function coverageDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function calcDaily(report) {
  let revenue = 0, revenueC1 = 0, revenueC2 = 0
  let km = 0, cost = 0, energyCost = 0
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
      energyCost += ts.daily?.energyCost || 0
      wagonCount += ts.daily?.wagonCount || 0
      locoCount += ts.daily?.locoCount || 0
    })
  }

  return {
    revenue, revenueC1, revenueC2,
    km, cost, energyCost, netto: revenue - cost,
    transferred, transferredC1, transferredC2,
    demandTotal, demandC1, demandC2,
    wagonCount, locoCount,
    realizationTotal: demandTotal > 0 ? transferred / demandTotal : 0,
    realizationC1: demandC1 > 0 ? transferredC1 / demandC1 : 0,
    realizationC2: demandC2 > 0 ? transferredC2 / demandC2 : 0
  }
}

export function useReportsData() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDailyIdx, setSelectedDailyIdx] = useState(0)
  const [selectedWeekKey, setSelectedWeekKey] = useState(null)
  const [selectedMonthKey, setSelectedMonthKey] = useState(null)
  const [selectedYearKey, setSelectedYearKey] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, `players/${auth.currentUser.uid}/Raporty`),
      orderBy('date', 'desc'),
      limit(365)
    )
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(doc => doc.data()))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const aggregates = useMemo(() => {
    if (reports.length === 0) return null

    const calcPeriod = (slice) => {
      const agg = {
        revenue: 0, revenueC1: 0, revenueC2: 0,
        km: 0, cost: 0, energyCost: 0, count: slice.length, byTrainSet: {},
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
        agg.energyCost += d.energyCost || 0
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
                revenue: 0, revenueC1: 0, revenueC2: 0,
                km: 0, transferred: 0, transferredC1: 0, transferredC2: 0,
                demandC1: 0, demandC2: 0, cost: 0, energyCost: 0, daysActive: 0, realizacje: []
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
            tsb.energyCost += ts.daily?.energyCost || 0
            tsb.daysActive += 1
            if (ts.daily?.realizacja !== undefined) tsb.realizacje.push(ts.daily.realizacja)

            if (ts.kursy) {
              if (!tsb.kursy) tsb.kursy = {}
              Object.entries(ts.kursy).forEach(([kId, k]) => {
                if (!tsb.kursy[kId]) {
                  tsb.kursy[kId] = {
                    odjazd: k.odjazd, from: k.from, to: k.to,
                    przychod: 0, przychodC1: 0, przychodC2: 0,
                    koszt: 0, energyCost: 0, km: 0, transferredTotal: 0,
                    transferredC1: 0, transferredC2: 0,
                    demandC1: 0, demandC2: 0, realizacje: []
                  }
                }
                const kb = tsb.kursy[kId]
                kb.przychod += k.przychod || 0
                kb.przychodC1 += k.przychodC1 || 0
                kb.przychodC2 += k.przychodC2 || 0
                kb.koszt += k.koszt || 0
                kb.energyCost += k.energyCost || 0
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
      calcPeriod,
      trendData: [...reports].reverse().map(r => ({ date: coverageDate(r.date), ...calcDaily(r) }))
    }
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

  return {
    reports, loading, aggregates, availablePeriods,
    dailyData, prevDailyData, weeklyData, monthlyData, yearlyData,
    selectedDailyIdx, setSelectedDailyIdx,
    selectedWeekKey, setSelectedWeekKey,
    selectedMonthKey, setSelectedMonthKey,
    selectedYearKey, setSelectedYearKey,
  }
}
