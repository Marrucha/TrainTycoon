import styles from '../CompanyMenu.module.css'
import FinanceBalance from './finance/FinanceBalance'
import FinancePL from './finance/FinancePL'
import FinanceLedger from './finance/FinanceLedger'
import FinanceDebt from './finance/FinanceDebt'
import FinanceDeposits from './finance/FinanceDeposits'
import FinanceStock from './finance/FinanceStock'

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
    emitShares,
}) => {
    return (
        <>
            <div className={styles.sectionHeader}>
                <h2>Finanse</h2>
                <p>Analizuj przepływy pieniężne i rentowność połączeń.</p>
            </div>

            <FinanceBalance
                budget={budget}
                trains={trains}
                baseTrains={baseTrains}
                deposits={deposits}
                playerDoc={playerDoc}
            />

            <FinancePL />
            <FinanceLedger />

            <div className={styles.sectionHeader} style={{ marginTop: '30px' }}>
                <h2>Sektor Bankowy</h2>
                <p>Zarządzaj kredytami, lokatami i akcjami swojej firmy.</p>
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
                <FinanceStock
                    playerDoc={playerDoc}
                    emitShares={emitShares}
                />
            </div>
        </>
    )
}

export default FinanceSection
