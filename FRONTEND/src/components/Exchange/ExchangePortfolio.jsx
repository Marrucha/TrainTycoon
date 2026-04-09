import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import ExchangeTradeModal from './ExchangeTradeModal'
import s from './Exchange.module.css'

export default function ExchangePortfolio() {
  const { myPortfolio, listedCompanies, playerDoc, sellShares } = useGame()
  const personalBalance = playerDoc?.personal?.balance ?? 0
  const holdings = myPortfolio?.holdings ?? {}
  const holdingEntries = Object.entries(holdings).filter(([, h]) => h.shares > 0)

  const [tradeModal, setTradeModal] = useState(null)

  const totalValue = holdingEntries.reduce((sum, [uid, h]) => {
    const company = listedCompanies.find(c => c.id === uid)
    return sum + (company?.marketPrice ?? 0) * h.shares
  }, 0)

  async function handleSell(shares) {
    const result = await sellShares(tradeModal.company.id, shares)
    alert(`Sprzedano! Kurs: ${result.pricePerShare} PLN/akcję, otrzymano: ${result.totalValue?.toLocaleString('pl-PL')} PLN`)
    setTradeModal(null)
  }

  return (
    <div>
      <div className={s.personalBadge}>
        <div className={s.personalBadgeLabel}>Majątek osobisty (personal.balance)</div>
        <div className={s.personalBadgeValue}>{personalBalance.toLocaleString('pl-PL')} PLN</div>
      </div>

      <div className={s.portfolioHeader}>
        <div>
          <div className={s.portfolioLabel}>Wartość portfela akcji</div>
          <div className={s.portfolioTotal}>{Math.round(totalValue).toLocaleString('pl-PL')} PLN</div>
        </div>
      </div>

      {holdingEntries.length === 0 ? (
        <div className={s.emptyState}>
          <span className={s.emptyIcon}>📊</span>
          <span>Nie posiadasz żadnych akcji</span>
          <span>Przejdź do zakładki "Rynek" i kup pierwsze akcje</span>
        </div>
      ) : (
        holdingEntries.map(([uid, holding]) => {
          const company = listedCompanies.find(c => c.id === uid)
          const currentPrice = company?.marketPrice ?? 0
          const currentValue = Math.round(currentPrice * holding.shares)
          const pnl = currentValue - (holding.totalInvested ?? 0)
          const pnlPct = holding.totalInvested > 0 ? (pnl / holding.totalInvested) * 100 : 0

          return (
            <div key={uid} className={s.holdingCard}>
              <div className={s.holdingInfo}>
                <div className={s.holdingName}>{company?.companyName ?? uid}</div>
                <div className={s.holdingMeta}>
                  {holding.shares.toLocaleString('pl-PL')} akcji · śr. koszt {holding.avgBuyPrice?.toFixed(2)} PLN · kurs {currentPrice.toFixed(2)} PLN
                </div>
              </div>
              <div className={s.holdingPnl}>
                <div className={s.pnlValue} style={{ color: pnl >= 0 ? '#4CAF50' : '#e74c3c' }}>
                  {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('pl-PL')} PLN
                </div>
                <div className={s.pnlPct}>
                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% ({currentValue.toLocaleString('pl-PL')} PLN)
                </div>
              </div>
              {company && (
                <button className={s.sellBtn} onClick={() => setTradeModal({ company, shares: holding.shares })}>
                  SPRZEDAJ
                </button>
              )}
            </div>
          )
        })
      )}

      {tradeModal && (
        <ExchangeTradeModal
          type="sell"
          company={tradeModal.company}
          ownedShares={tradeModal.shares}
          personalBalance={personalBalance}
          onConfirm={handleSell}
          onClose={() => setTradeModal(null)}
        />
      )}
    </div>
  )
}
