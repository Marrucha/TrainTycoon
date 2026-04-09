import { useState } from 'react'
import ExchangeMarketList from './ExchangeMarketList'
import ExchangeMyCompany from './ExchangeMyCompany'
import ExchangePortfolio from './ExchangePortfolio'
import s from './Exchange.module.css'
import cmStyles from '../CompanyMenu/CompanyMenu.module.css'

const TABS = [
  { id: 'market',    label: 'Rynek' },
  { id: 'company',   label: 'Moja spółka' },
]

export default function ExchangeSection() {
  const [activeTab, setActiveTab] = useState('market')

  return (
    <div className={s.container}>
      <div className={cmStyles.sectionHeader} style={{ flexShrink: 0 }}>
        <h2>Giełda</h2>
        <p>Handluj akcjami innych firm i zarządzaj swoimi udziałami.</p>
      </div>
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
        {activeTab === 'company'   && <ExchangeMyCompany />}
      </div>
    </div>
  )
}
