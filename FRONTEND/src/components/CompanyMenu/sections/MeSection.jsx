import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase/config';
import ExchangePortfolio from '../../Exchange/ExchangePortfolio';
import { useGame } from '../../../context/GameContext';
import styles from '../CompanyMenu.module.css';

const HOUSE_DATA = {
    'blok': { name: 'Mieszkanie (Blok)', price: 1500000 },
    'dom1': { name: 'Willa', price: 2500000 },
    'dom2': { name: 'Większa Willa', price: 4000000 },
    'dom3': { name: 'Posiadłość', price: 10000000 },
    'dom4': { name: 'Rezydencja', price: 50000000 },
};

export default function MeSection({ currentBg, setBg }) {
    const { playerDoc, financeLedger } = useGame();
    const [actionView, setActionView] = useState(null);
    
    const ownedHouses = (playerDoc?.personal?.ownedHouses || ['blok']).map(h => h.toLowerCase());

    const handleHouseBuy = async (houseId) => {
        const price = HOUSE_DATA[houseId].price;
        const personalBalance = playerDoc?.personal?.balance || 0;
        
        if (personalBalance >= price) {
            if (window.confirm(`Czy na pewno chcesz kupić "${HOUSE_DATA[houseId].name}" za ${price.toLocaleString('pl-PL')} PLN z własnej kieszeni?`)) {
                try {
                    await updateDoc(doc(db, `players/${auth.currentUser.uid}`), {
                        'personal.balance': personalBalance - price,
                        'personal.ownedHouses': [...ownedHouses, houseId],
                        'personal.currentBg': houseId
                    });
                    setBg(houseId);
                    alert("Gratulacje, kupiłeś nową nieruchomość!");
                } catch (e) {
                    alert("Wystąpił błąd podczas zakupu.");
                    console.error(e);
                }
            }
        } else {
            alert(`Nie stać Cię! Brakuje Ci ${(price - personalBalance).toLocaleString('pl-PL')} PLN na osobistym koncie.`);
        }
    };

    const handleHouseSell = async (houseId) => {
        const price = HOUSE_DATA[houseId].price;
        if (window.confirm(`Czy na pewno chcesz sprzedać "${HOUSE_DATA[houseId].name}" za ${price.toLocaleString('pl-PL')} PLN?`)) {
            try {
                const newOwned = ownedHouses.filter(h => h !== houseId);
                const nextBg = currentBg === houseId ? (newOwned[newOwned.length - 1] || 'blok') : currentBg;
                
                await updateDoc(doc(db, `players/${auth.currentUser.uid}`), {
                    'personal.balance': (playerDoc?.personal?.balance || 0) + price,
                    'personal.ownedHouses': newOwned,
                    'personal.currentBg': nextBg
                });
                if (currentBg === houseId) setBg(nextBg);
                alert("Nieruchomość została sprzedana!");
            } catch (e) {
                alert("Wystąpił błąd podczas sprzedaży.");
                console.error(e);
            }
        }
    };
    
    // Pensja podstawowa
    const baseVal = 30000;
    
    // Ostatni pełny zamknięty miesiąc
    let lastNetResult = 0;
    if (financeLedger) {
        const monthlyDocs = financeLedger.filter(d => d.id?.startsWith('monthly-'));
        if (monthlyDocs && monthlyDocs.length > 0) {
            lastNetResult = monthlyDocs[0].netResult || 0;
        }
    }
    
    // Premia od wyniku netto (0.1%)
    const bonus = lastNetResult > 0 ? lastNetResult * 0.001 : 0;
    const totalSalary = Math.round(baseVal + bonus);
    return (
        <>
            <div className={styles.sectionHeader} style={{ position: 'relative' }}>
                <h2>Ja</h2>
                <p>Twój majątek osobisty i portfel inwestycyjny.</p>
            </div>

            {/* Background switcher */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button 
                  onClick={() => setBg('blok')} 
                  style={{ background: currentBg?.toLowerCase() === 'blok' ? '#1a3a1a' : 'rgba(0,0,0,0.55)', border: `1px solid ${currentBg?.toLowerCase() === 'blok' ? '#2ecc71' : 'rgba(255,255,255,0.25)'}`, color: currentBg?.toLowerCase() === 'blok' ? '#2ecc71' : '#ccc', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
                  Tło: Mieszkanie
                </button>
                <button 
                  onClick={() => setBg('Garaż')} 
                  style={{ background: currentBg === 'Garaż' ? '#1a3a1a' : 'rgba(0,0,0,0.55)', border: `1px solid ${currentBg === 'Garaż' ? '#2ecc71' : 'rgba(255,255,255,0.25)'}`, color: currentBg === 'Garaż' ? '#2ecc71' : '#ccc', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
                  Tło: Garaż
                </button>
                <button 
                  onClick={() => setBg('Galeria')} 
                  style={{ background: currentBg === 'Galeria' ? '#1a3a1a' : 'rgba(0,0,0,0.55)', border: `1px solid ${currentBg === 'Galeria' ? '#2ecc71' : 'rgba(255,255,255,0.25)'}`, color: currentBg === 'Galeria' ? '#2ecc71' : '#ccc', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
                  Tło: Galeria
                </button>
                <button 
                  onClick={() => setBg('Lądowisko')} 
                  style={{ background: currentBg === 'Lądowisko' ? '#1a3a1a' : 'rgba(0,0,0,0.55)', border: `1px solid ${currentBg === 'Lądowisko' ? '#2ecc71' : 'rgba(255,255,255,0.25)'}`, color: currentBg === 'Lądowisko' ? '#2ecc71' : '#ccc', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
                  Tło: Lądowisko
                </button>
            </div>

            {/* Asset management buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setActionView(actionView === 'house' ? null : 'house')}
                  style={{ background: actionView === 'house' ? '#1a5276' : '#2980b9', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 4, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>
                  Kup / Sprzedaj Dom
                </button>
                <button style={{ background: '#8e44ad', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 4, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>
                  Kup / Sprzedaj Samochód
                </button>
                <button style={{ background: '#d35400', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 4, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>
                  Kup / Sprzedaj Sztukę
                </button>
                <button style={{ background: '#c0392b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 4, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>
                  Kup / Sprzedaj Helikopter
                </button>
            </div>

            {/* Sub-view for House Action */}
            {actionView === 'house' && (
                <div style={{ background: 'rgba(41, 128, 185, 0.1)', backdropFilter: 'blur(4px)', border: '1px solid rgba(41, 128, 185, 0.3)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <h3 style={{ marginTop: 0, fontSize: '14px', color: '#3498db', textTransform: 'uppercase' }}>Katalog Nieruchomości</h3>
                    <p style={{ fontSize: '12px', color: '#bbb', marginBottom: '16px' }}>Wybierz i zamieszkaj w nowej nieruchomości. Tło strony zmieni się na podgląd obiektu.</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {Object.entries(HOUSE_DATA).map(([id, info]) => {
                            const isOwned = ownedHouses.includes(id);
                            return (
                                <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <button
                                        onClick={() => isOwned ? handleHouseSell(id) : handleHouseBuy(id)}
                                        style={{
                                            background: isOwned ? 'rgba(231, 76, 60, 0.2)' : 'rgba(0,0,0,0.4)',
                                            border: `1px solid ${isOwned ? '#e74c3c' : 'rgba(255,255,255,0.1)'}`,
                                            color: isOwned ? '#e74c3c' : '#aaa', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                                        }}
                                    >
                                        {isOwned ? `Sprzedaj: ${info.name}` : `Kup: ${info.name}`}
                                    </button>
                                    <div style={{ fontSize: '10px', color: '#888', textAlign: 'center' }}>
                                        Wartość: {info.price.toLocaleString('pl-PL')} PLN
                                    </div>
                                    {isOwned && (
                                        <button
                                            onClick={() => { setBg(id); updateDoc(doc(db, `players/${auth.currentUser.uid}`), { 'personal.currentBg': id }); }}
                                            style={{
                                                background: currentBg === id ? 'rgba(52, 152, 219, 0.8)' : 'rgba(52, 152, 219, 0.2)',
                                                border: `1px solid ${currentBg === id ? '#fff' : 'rgba(52, 152, 219, 0.5)'}`,
                                                color: '#fff', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', marginTop: '2px'
                                            }}
                                        >
                                            {currentBg === id ? 'Zamieszkane ✓' : 'Ustaw jako tło'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div style={{ background: 'rgba(22, 38, 22, 0.75)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', border: '1px solid rgba(138, 171, 138, 0.35)', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#8aab8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pensja Prezesa Zarządu</span>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: '#f1c40f' }}>{totalSalary.toLocaleString('pl-PL')} <span style={{ fontSize: '14px', color: '#8aab8a', fontWeight: 'normal' }}>PLN / miesiąc</span></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px', fontSize: '11px', color: '#8aa' }}>
                    <span>Podstawa: <strong>{baseVal.toLocaleString('pl-PL')} PLN</strong></span>
                    {bonus > 0 && <span>+ Premia z zysku (0.1%): <strong>{Math.round(bonus).toLocaleString('pl-PL')} PLN</strong></span>}
                </div>
            </div>

            <ExchangePortfolio />
        </>
    );
}
