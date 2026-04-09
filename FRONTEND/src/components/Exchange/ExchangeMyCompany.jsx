import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import { auth } from '../../firebase/config'
import s from './Exchange.module.css'

const fmt = (n) => Math.round(n ?? 0).toLocaleString('pl-PL')

export default function ExchangeMyCompany() {
  const { playerDoc, listedCompanies, requestListing, payDividend } = useGame()
  const myUid = auth.currentUser?.uid
  const myExchange = listedCompanies.find(c => c.id === myUid)
  const isListed = !!myExchange

  const [listingLoading, setListingLoading] = useState(false)
  const [listingResult, setListingResult] = useState(null)
  const [divPerShare, setDivPerShare] = useState('')
  const [divLoading, setDivLoading] = useState(false)

  async function handleRequestListing() {
    setListingLoading(true)
    setListingResult(null)
    try {
      const res = await requestListing()
      setListingResult(res)
    } catch (e) {
      setListingResult({ eligible: false, failedChecks: [e.message] })
    } finally {
      setListingLoading(false)
    }
  }

  async function handlePayDividend() {
    const pln = parseFloat(divPerShare)
    if (!pln || pln <= 0) return alert('Podaj prawidłową kwotę dywidendy')
    if (!window.confirm(`Wypłacić dywidendę ${pln} PLN/akcję wszystkim akcjonariuszom?`)) return
    setDivLoading(true)
    try {
      const res = await payDividend(pln)
      alert(`Dywidenda wypłacona! Łącznie: ${res.totalPayout?.toLocaleString('pl-PL')} PLN do ${res.holdersCount} akcjonariuszy.`)
      setDivPerShare('')
    } catch (e) {
      alert('Błąd: ' + e.message)
    } finally {
      setDivLoading(false)
    }
  }

  return (
    <div>
      {/* Status notowania */}
      <div className={s.statusCard}>
        <div className={s.statusRow}>
          <span className={isListed ? `${s.statusBadge} ${s.badgeListed}` : `${s.statusBadge} ${s.badgeUnlisted}`}>
            {isListed ? 'NOTOWANA' : 'NIENOTOWANA'}
          </span>
          <span style={{ fontSize: 12, color: '#6a8a6a' }}>
            {playerDoc.companyName}
          </span>
        </div>

        {isListed && (
          <>
            <div className={s.valuationGrid}>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>Cena rynkowa</div>
                <div className={s.valuationCellValue}>{myExchange.marketPrice?.toFixed(2)} PLN</div>
              </div>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>Cena fundamentalna</div>
                <div className={s.valuationCellValue}>{myExchange.fundamentalPrice?.toFixed(2)} PLN</div>
              </div>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>P/E</div>
                <div className={s.valuationCellValue}>{myExchange.peMultiple?.toFixed(1)}×</div>
              </div>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>NAV</div>
                <div className={s.valuationCellValue}>{fmt(myExchange.nav)} PLN</div>
              </div>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>Zysk (trail. 7d)</div>
                <div className={s.valuationCellValue}>{fmt(myExchange.trailingDailyNet)}/d</div>
              </div>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>Akcjonariusze</div>
                <div className={s.valuationCellValue}>{myExchange.uniqueHolders ?? 0}</div>
              </div>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>Wolny obrót</div>
                <div className={s.valuationCellValue}>{fmt(myExchange.freeFloat)}</div>
              </div>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>Suma akcji</div>
                <div className={s.valuationCellValue}>{fmt(myExchange.totalShares)}</div>
              </div>
              <div className={s.valuationCell}>
                <div className={s.valuationCellLabel}>Kap. rynkowa</div>
                <div className={s.valuationCellValue}>{fmt((myExchange.marketPrice ?? 0) * (myExchange.totalShares ?? 0))} PLN</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Wniosek o notowanie */}
      {!isListed && (
        <div className={s.statusCard}>
          <p className={s.sectionTitle}>Debiut giełdowy (IPO)</p>
          <p style={{ fontSize: 12, color: '#6a8a6a', margin: '0 0 12px' }}>
            Sprawdź wymagania i złóż wniosek o notowanie spółki.
          </p>

          {listingResult && (
            <div className={s.checklist}>
              {listingResult.eligible
                ? <p style={{ color: '#4CAF50', fontSize: 12 }}>Spółka zadebiutowała na giełdzie!</p>
                : listingResult.failedChecks?.map((f, i) => (
                    <div key={i} className={s.checkItem}>
                      <span className={s.checkIcon}>✗</span>
                      <span className={`${s.checkText} ${s.checkFailed}`}>{f}</span>
                    </div>
                  ))
              }
            </div>
          )}

          <button className={s.actionBtn} onClick={handleRequestListing} disabled={listingLoading}>
            {listingLoading && <span className={s.spinner} />}
            Złóż wniosek o IPO
          </button>
        </div>
      )}

      {/* Dywidenda */}
      {isListed && myExchange.freeFloat > 0 && (
        <div className={s.statusCard}>
          <p className={s.sectionTitle}>Dywidenda</p>
          {myExchange.lastDividendAt && (
            <p style={{ fontSize: 11, color: '#6a8a6a', margin: '0 0 8px' }}>
              Ostatnia dywidenda: {myExchange.lastDividendAt}
            </p>
          )}
          <p style={{ fontSize: 12, color: '#6a8a6a', margin: '0 0 8px' }}>
            Możliwa max raz na 30 game-dni. Pobierana z kasy firmy, trafia do personal.balance akcjonariuszy.
          </p>
          <div className={s.dividendRow}>
            <input
              type="number"
              className={s.dividendInput}
              placeholder="PLN/akcję"
              value={divPerShare}
              min={0.01}
              step={0.01}
              onChange={e => setDivPerShare(e.target.value)}
            />
            <button className={s.actionBtn} style={{ marginTop: 0 }} onClick={handlePayDividend} disabled={divLoading || !divPerShare}>
              {divLoading && <span className={s.spinner} />}
              Wypłać dywidendę
            </button>
          </div>
          {divPerShare && myExchange.totalShares && (
            <p style={{ fontSize: 11, color: '#8a8a6a', marginTop: 8 }}>
              Szacunkowy koszt: {Math.round(parseFloat(divPerShare || 0) * (myExchange.freeFloat || 0)).toLocaleString('pl-PL')} PLN
            </p>
          )}
        </div>
      )}
    </div>
  )
}
