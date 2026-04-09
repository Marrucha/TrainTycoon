import styles from '../CompanyMenu.module.css'
import FinanceBalance from './finance/FinanceBalance'
import FinanceDebt from './finance/FinanceDebt'
import FinanceDeposits from './finance/FinanceDeposits'

const FinanceSection = ({
    budget,
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
    return (
        <>
            <div className={styles.sectionHeader}>
                <h2>Mój Bank</h2>
                <p>Zarządzaj kredytami, lokatami i płynnością finansową firmy.</p>
            </div>

            <FinanceBalance
                budget={budget}
                trains={trains}
                baseTrains={baseTrains}
                deposits={deposits}
                playerDoc={playerDoc}
            />

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
    )
}

export default FinanceSection
