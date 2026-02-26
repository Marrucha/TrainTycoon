import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import FleetAssets from './FleetAssets'
import FleetCompositions from './FleetCompositions'
import styles from './FleetMenu.module.css'
import subStyles from './FleetCompositions.module.css'

export default function FleetMenu() {
    const [activeSubTab, setActiveSubTab] = useState('assets') // 'assets' lub 'compositions'

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={subStyles.headerTop}>
                    <h2>Zarządzanie Flotą</h2>

                    <div className={subStyles.subTabs}>
                        <button
                            className={`${subStyles.subTabBtn} ${activeSubTab === 'assets' ? subStyles.active : ''}`}
                            onClick={() => setActiveSubTab('assets')}
                        >
                            Elementy Floty (Zasoby)
                        </button>
                        <button
                            className={`${subStyles.subTabBtn} ${activeSubTab === 'compositions' ? subStyles.active : ''}`}
                            onClick={() => setActiveSubTab('compositions')}
                        >
                            Ułożone Składy Pociągów
                        </button>
                    </div>
                </div>
                <p className={subStyles.subtitle}>
                    {activeSubTab === 'assets'
                        ? 'Przeglądaj wszystkie posiadane wagony, lokomotywy i systemy doczepiane w Twoim inwentarzu.'
                        : 'Zestawiaj ze sobą lokomotywy oraz wagony, tworząc pociągi gotowe do wyjechania w trasę.'}
                </p>
            </header>

            {activeSubTab === 'assets' ? <FleetAssets /> : <FleetCompositions />}
        </div>
    )
}
