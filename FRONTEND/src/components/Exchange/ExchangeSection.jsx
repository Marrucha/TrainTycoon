import { useState } from 'react'
import ExchangeMarketList from './ExchangeMarketList'
import ExchangeMyCompany from './ExchangeMyCompany'
import ExchangePortfolio from './ExchangePortfolio'
import s from './Exchange.module.css'

const TABS = [
  { id: 'market',    label: 'Rynek' },
  { id: 'portfolio', label: 'Mój portfel' },
  { id: 'company',   label: 'Moja spółka' },
]

export default function ExchangeSection() {
  const [activeTab, setActiveTab] = useState('market')

  return (
    <div className={s.container}>
      <div className={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${s.tab} ${activeTab === t.id ? s.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={s.tabContent}>
        {activeTab === 'market'    && <ExchangeMarketList />}
        {activeTab === 'portfolio' && <ExchangePortfolio />}
        {activeTab === 'company'   && <ExchangeMyCompany />}
      </div>
    </div>
  )
}
