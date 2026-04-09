import { useState } from 'react'
import s from './Exchange.module.css'

const BUY_SPREAD  = 1.02
const SELL_SPREAD = 0.98

export default function ExchangeTradeModal({ type, company, ownedShares, personalBalance, onConfirm, onClose }) {
  const maxShares = type === 'buy'
    ? Math.min(company.freeFloat || 0, Math.floor(personalBalance / (company.marketPrice * BUY_SPREAD)))
    : ownedShares

  const [shares, setShares] = useState(Math.min(100, maxShares))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pricePerShare = type === 'buy'
    ? company.marketPrice * BUY_SPREAD
    : company.marketPrice * SELL_SPREAD

  const totalValue = Math.round(shares * pricePerShare)

  async function handleConfirm() {
    if (shares <= 0 || shares > maxShares) return
    setLoading(true)
    setError('')
    try {
      await onConfirm(shares)
    } catch (e) {
      setError(e.message || 'Błąd transakcji')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <p className={s.modalTitle}>{type === 'buy' ? 'Kup akcje' : 'Sprzedaj akcje'}</p>
        <p className={s.modalSubtitle}>{company.companyName}</p>

        <hr className={s.divider} />

        <div className={s.modalRow}>
          <span className={s.modalLabel}>Cena rynkowa</span>
          <span className={s.modalValue}>{company.marketPrice?.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</span>
        </div>
        <div className={s.modalRow}>
          <span className={s.modalLabel}>{type === 'buy' ? 'Cena zakupu (z prowizją 2%)' : 'Cena sprzedaży (po prowizji 2%)'}</span>
          <span className={s.modalValue}>{pricePerShare.toFixed(2)} PLN</span>
        </div>
        {type === 'buy' && (
          <div className={s.modalRow}>
            <span className={s.modalLabel}>Dostępne środki osobiste</span>
            <span className={s.modalValue}>{personalBalance.toLocaleString('pl-PL')} PLN</span>
          </div>
        )}
        {type === 'sell' && (
          <div className={s.modalRow}>
            <span className={s.modalLabel}>Posiadane akcje</span>
            <span className={s.modalValue}>{ownedShares.toLocaleString('pl-PL')}</span>
          </div>
        )}

        <hr className={s.divider} />

        <div className={s.sliderRow}>
          <label className={s.modalLabel}>Liczba akcji</label>
          <input
            type="number"
            className={s.sharesInput}
            value={shares}
            min={1}
            max={maxShares}
            onChange={e => setShares(Math.max(1, Math.min(maxShares, parseInt(e.target.value) || 0)))}
          />
          <input
            type="range"
            className={s.slider}
            min={1}
            max={maxShares || 1}
            value={shares}
            onChange={e => setShares(parseInt(e.target.value))}
          />
          <div className={s.sliderLabels}>
            <span>1</span>
            <span>{(maxShares / 2).toFixed(0)}</span>
            <span>{maxShares.toLocaleString('pl-PL')}</span>
          </div>
        </div>

        <hr className={s.divider} />

        <div className={s.modalRow}>
          <span className={s.modalLabel}>{type === 'buy' ? 'Koszt całkowity' : 'Otrzymasz'}</span>
          <span className={`${s.totalCost} ${type === 'buy' ? s.modalValueRed : s.modalValueGreen}`}>
            {totalValue.toLocaleString('pl-PL')} PLN
          </span>
        </div>

        {error && <p className={s.errorMsg}>{error}</p>}

        <div className={s.modalActions}>
          <button className={s.cancelBtn} onClick={onClose} disabled={loading}>Anuluj</button>
          {type === 'buy'
            ? <button className={s.confirmBuyBtn} onClick={handleConfirm} disabled={loading || shares <= 0 || totalValue > personalBalance}>
                {loading && <span className={s.spinner} />}
                Kup {shares.toLocaleString('pl-PL')} akcji
              </button>
            : <button className={s.confirmSellBtn} onClick={handleConfirm} disabled={loading || shares <= 0}>
                {loading && <span className={s.spinner} />}
                Sprzedaj {shares.toLocaleString('pl-PL')} akcji
              </button>
          }
        </div>
      </div>
    </div>
  )
}
