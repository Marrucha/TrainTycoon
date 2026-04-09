import { useState } from 'react'
import styles from '../CompanyMenu.module.css'
import FinanceBalance from './finance/FinanceBalance'
import FinancePL from './finance/FinancePL'
import FinanceLedger from './finance/FinanceLedger'
import FinanceDebt from './finance/FinanceDebt'
import FinanceDeposits from './finance/FinanceDeposits'
import ExchangeSection from '../../Exchange/ExchangeSection'
import ReportsMenu from '../../Reports/ReportsMenu'

const TABS = [
    { id: 'bank',    label: 'Sektor bankowy' },
    { id: 'reports', label: 'Raporty operacyjne' },
    { id: 'ledger',  label: 'Księgowość' },
    { id: 'exchange', label: 'Giełda' },
]

const tabBarStyle = {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #1a331a',
    marginBottom: '20px',
    flexShrink: 0,
}

const tabStyle = (active) => ({
    padding: '9px 18px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: active ? '#4CAF50' : '#4a6a4a',
    cursor: 'pointer',
    borderBottom: active ? '2px solid #4CAF50' : '2px solid transparent',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #4CAF50' : '2px solid transparent',
    fontFamily: 'inherit',
    transition: 'color 0.15s',
})

const FinanceSection = ({
    budget,
    reputation,
    playerDoc,
    trains = [],
    baseTrains = [],
    openCreditLine,
    takeLoan,
    toggleGroup,
    expandedGroups,
    deposits,
    depositRates,
    openDeposit,
    redeemDeposit,
    breakDeposit,
}) => {
    const [activeTab, setActiveTab] = useState('bank')

    return (
        <>
            <div style={tabBarStyle}>
                {TABS.map(t => (
                    <button key={t.id} style={tabStyle(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'bank' && (
                <>
                    <FinanceBalance
                        budget={budget}
                        trains={trains}
                        baseTrains={baseTrains}
                        deposits={deposits}
                        playerDoc={playerDoc}
                    />
                    <div className={styles.sectionHeader} style={{ marginTop: '20px' }}>
                        <h2>Sektor Bankowy</h2>
                        <p>Zarządzaj kredytami i lokatami swojej firmy.</p>
                    </div>
                    <div className={styles.grid}>
                        <FinanceDebt
                            budget={budget}
                            playerDoc={playerDoc}
                            openCreditLine={openCreditLine}
                            takeLoan={takeLoan}
                            toggleGroup={toggleGroup}
                            expandedGroups={expandedGroups}
                        />
                        <FinanceDeposits
                            deposits={deposits}
                            depositRates={depositRates}
                            openDeposit={openDeposit}
                            redeemDeposit={redeemDeposit}
                            breakDeposit={breakDeposit}
                        />
                    </div>
                </>
            )}

            {activeTab === 'reports' && <ReportsMenu />}

            {activeTab === 'ledger' && <FinanceLedger />}

            {activeTab === 'exchange' && (
                <div style={{ height: 'calc(100vh - 160px)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <ExchangeSection />
                </div>
            )}
        </>
    )
}

export default FinanceSection
