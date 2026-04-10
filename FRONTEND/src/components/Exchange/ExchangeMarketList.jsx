import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import { auth } from '../../firebase/config'
import ExchangeTradeModal from './ExchangeTradeModal'
import ExchangePriceChart from './ExchangePriceChart'
import s from './Exchange.module.css'

const fmt = (n) => Math.round(n ?? 0).toLocaleString('pl-PL')

function pctChange(current, prev) {
  if (!prev || prev === 0) return null
  return ((current - prev) / prev) * 100
}

function NavTooltip({ company }) {
  const bd = company.navBreakdown || {}
  const totalShares = company.totalShares || 1
  const fundPrice   = company.fundamentalPrice || 0
  const nav         = company.nav || 0
  const earn        = company.earningsValue || 0
  const pe          = company.peMultiple || 0
  const trailing    = company.trailingDailyNet || 0
  const annualized  = company.annualizedNet ?? Math.round(trailing * 365)

  return (
    <span className={s.navTooltipWrapper}>
      {fundPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
      <span className={s.navTooltip}>
        <div className={s.navTooltipTitle}>Składowe wyceny fundamentalnej</div>

        <div className={s.navTooltipTitle} style={{ marginTop: 4 }}>Aktywa netto (NAV)</div>
        <div className={s.navTooltipRow}>
          <span className={s.navTooltipLabel}>Gotówka</span>
          <span className={`${s.navTooltipValue} ${s.navTooltipPos}`}>{fmt(bd.navCash)} PLN</span>
        </div>
        {bd.navDeposits > 0 && (
          <div className={s.navTooltipRow}>
            <span className={s.navTooltipLabel}>Lokaty</span>
            <span className={`${s.navTooltipValue} ${s.navTooltipPos}`}>{fmt(bd.navDeposits)} PLN</span>
          </div>
        )}
        <div className={s.navTooltipRow}>
          <span className={s.navTooltipLabel}>Flota (wart. rynk.)</span>
          <span className={`${s.navTooltipValue} ${s.navTooltipPos}`}>{fmt(bd.navFleetRaw)} PLN</span>
        </div>
        <div className={s.navTooltipRow}>
          <span className={s.navTooltipLabel}>Flota (wart. po amortyzacji)</span>
          <span className={`${s.navTooltipValue} ${s.navTooltipPos}`}>{fmt(bd.navFleetHaircut)} PLN</span>
        </div>
        {bd.navLoans > 0 && (
          <div className={s.navTooltipRow}>
            <span className={s.navTooltipLabel}>Zobowiązania kredytowe</span>
            <span className={`${s.navTooltipValue} ${s.navTooltipNeg}`}>−{fmt(bd.navLoans)} PLN</span>
          </div>
        )}
        <div className={s.navTooltipRowTotal}>
          <span className={s.navTooltipLabel}>NAV łącznie</span>
          <span className={s.navTooltipValue}>{fmt(nav)} PLN</span>
        </div>

        <div className={s.navTooltipSection}>
          <div className={s.navTooltipTitle}>Wartość zysku (earnings)</div>
          <div className={s.navTooltipRow}>
            <span className={s.navTooltipLabel}>Śr. zysk dzienny (7d)</span>
            <span className={s.navTooltipValue}>{fmt(trailing)} PLN</span>
          </div>
          <div className={s.navTooltipRow}>
            <span className={s.navTooltipLabel}>Zysk roczny {(company.dailyNetHistory?.length ?? 0) >= 365 ? '(12m kroczące)' : '(ekstrapolacja)'}</span>
            <span className={s.navTooltipValue}>{fmt(annualized)} PLN</span>
          </div>
          <div className={s.navTooltipRow}>
            <span className={s.navTooltipLabel}>Mnożnik P/E</span>
            <span className={s.navTooltipValue}>{pe}×</span>
          </div>
          <div className={s.navTooltipRowTotal}>
            <span className={s.navTooltipLabel}>Earnings value</span>
            <span className={s.navTooltipValue}>{fmt(earn)} PLN</span>
          </div>
        </div>

        <div className={s.navTooltipSection}>
          <div className={s.navTooltipTitle}>Formuła wyceny</div>
          <div className={s.navTooltipRow}>
            <span className={s.navTooltipLabel}>NAV × 40%</span>
            <span className={s.navTooltipValue}>{fmt(nav * 0.4)} PLN</span>
          </div>
          <div className={s.navTooltipRow}>
            <span className={s.navTooltipLabel}>Earnings × 60%</span>
            <span className={s.navTooltipValue}>{fmt(earn * 0.6)} PLN</span>
          </div>
          <div className={s.navTooltipRowTotal}>
            <span className={s.navTooltipLabel}>Wartość spółki</span>
            <span className={s.navTooltipValue}>{fmt(nav * 0.4 + earn * 0.6)} PLN</span>
          </div>
          <div className={s.navTooltipRowTotal}>
            <span className={s.navTooltipLabel}>Cena / akcję ({fmt(totalShares)} akcji)</span>
            <span className={`${s.navTooltipValue} ${s.navTooltipPos}`}>{fundPrice.toFixed(2)} PLN</span>
          </div>
        </div>
      </span>
    </span>
  )
}

export default function ExchangeMarketList() {
  const { listedCompanies, myPortfolio, playerDoc, buyShares, sellShares } = useGame()
  const myUid = auth.currentUser?.uid
  const personalBalance = playerDoc?.personal?.balance ?? 0

  const [tradeModal, setTradeModal] = useState(null) // { type, company }

  const sorted = [...listedCompanies].sort((a, b) => (b.marketPrice || 0) - (a.marketPrice || 0))

  async function handleConfirm(shares) {
    const { type, company } = tradeModal
    const result = type === 'buy'
      ? await buyShares(company.id, shares)
      : await sellShares(company.id, shares)
    alert(`Transakcja wykonana! Kurs: ${result.pricePerShare} PLN/akcję, wartość: ${result.totalValue?.toLocaleString('pl-PL')} PLN`)
    setTradeModal(null)
  }

  if (sorted.length === 0) {
    return (
      <div className={s.marketContainer}>
        <div className={s.emptyState}>
          <span className={s.emptyIcon}>📈</span>
          <span>Brak spółek notowanych na giełdzie</span>
        </div>
      </div>
    )
  }

  return (
    <div className={s.marketContainer}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Spółka</th>
            <th className={s.right}>Cena rynk.</th>
            <th className={s.right}>Fundam.</th>
            <th className={s.right}>Zmiana</th>
            <th className={s.right}>Wykres 14d</th>
            <th className={s.right}>Wolny obrót</th>
            <th className={s.right}>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(company => {
            const isOwn = company.ownerUid === myUid || company.id === myUid
            const chg = pctChange(company.marketPrice, company.prevDayPrice)
            const ownedShares = myPortfolio?.holdings?.[company.id]?.shares ?? 0

            return (
              <tr key={company.id}>
                <td>
                  <div className={s.companyName}>{company.companyName}</div>
                  {ownedShares > 0 && (
                    <div style={{ fontSize: 10, color: '#4a8a6a', marginTop: 2 }}>
                      Posiadasz: {ownedShares.toLocaleString('pl-PL')} akcji
                    </div>
                  )}
                </td>
                <td className={`${s.right} ${s.price}`}>
                  {company.marketPrice?.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                </td>
                <td className={`${s.right} ${s.fundamentalPrice}`}>
                  <NavTooltip company={company} />
                </td>
                <td className={`${s.right} ${s.changeCell}`}>
                  {chg === null ? (
                    <span className={s.priceNeutral}>–</span>
                  ) : (
                    <span className={chg > 0 ? s.priceUp : chg < 0 ? s.priceDown : s.priceNeutral}>
                      {chg > 0 ? '+' : ''}{chg.toFixed(2)}%
                    </span>
                  )}
                </td>
                <td className={s.right}>
                  <ExchangePriceChart ownerUid={company.id} width={80} height={28} />
                </td>
                <td className={`${s.right}`} style={{ color: '#8a8a8a', fontSize: 11 }}>
                  {(company.freeFloat || 0).toLocaleString('pl-PL')}
                </td>
                <td className={s.right}>
                  {isOwn ? (
                    <span className={s.ownLabel}>własna</span>
                  ) : (
                    <div className={s.tradeButtons}>
                      <button className={s.buyBtn} onClick={() => setTradeModal({ type: 'buy', company })}>
                        KUP
                      </button>
                      {ownedShares > 0 && (
                        <button className={s.sellBtn} onClick={() => setTradeModal({ type: 'sell', company })}>
                          SPRZEDAJ
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {tradeModal && (
        <ExchangeTradeModal
          type={tradeModal.type}
          company={tradeModal.company}
          ownedShares={myPortfolio?.holdings?.[tradeModal.company.id]?.shares ?? 0}
          personalBalance={personalBalance}
          onConfirm={handleConfirm}
          onClose={() => setTradeModal(null)}
        />
      )}
    </div>
  )
}
