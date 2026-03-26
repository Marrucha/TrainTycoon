import React, { useRef, useState } from 'react';
import styles from '../CompanyMenu.module.css';
import { storage, db, auth } from '../../../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

const TrendIcon = ({ current, prev }) => {
    if (prev === null || prev === undefined) return null;
    const diff = current - prev;
    if (diff > 0.005)  return <span style={{ color: '#2ecc71', fontSize: '13px', marginLeft: '5px', lineHeight: 1 }}>↑</span>;
    if (diff < -0.005) return <span style={{ color: '#e74c3c', fontSize: '13px', marginLeft: '5px', lineHeight: 1 }}>↓</span>;
    return <span style={{ color: '#f1c40f', fontSize: '13px', marginLeft: '5px', lineHeight: 1, fontWeight: 'bold' }}>–</span>;
};

const ReputationBar = ({ label, value, max = 20, color = '#2ecc71', barHeight, decimals = 1, prevValue }) => {
    const clampedValue = Math.min(value, max);
    const height = barHeight ?? Math.round((max / 20) * 10);
    return (
    <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', color: '#fff', fontWeight: '800', letterSpacing: '1px' }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' }}>{label}</span>
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {clampedValue.toFixed(decimals)} <span style={{ opacity: 0.6, marginLeft: 2 }}>/ {max}</span>
                <TrendIcon current={value} prev={prevValue} />
            </span>
        </div>
        <div style={{ height: `${height}px`, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${(clampedValue / max) * 100}%`, height: '100%', background: color, boxShadow: `0 0 15px ${color}55`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>
    </div>
    );
};

const PolicySection = ({ companyName, defaultPricing, reputation, playerDoc }) => {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const details     = playerDoc?.reputationDetails     || {};
    const prevDetails = playerDoc?.reputationDetailsPrev || null;

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            // 1. Upload to Storage
            const storageRef = ref(storage, `brandings/${auth.currentUser.uid}/logo_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 2. Update Firestore
            const playerRef = doc(db, 'players', auth.currentUser.uid);
            await updateDoc(playerRef, {
                logoUrl: downloadURL
            });
            
            alert('Branding zaktualizowany pomyślnie!');
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Wystąpił błąd podczas wgrywania logo.');
        } finally {
            setUploading(false);
        }
    };

    const subScores = [
        { label: "PUNKTUALNOŚĆ",              val: details.punctualityScore ?? 10, max: 20, prevKey: 'punctualityScore' },
        { label: "STAŁOŚĆ TRAS",              val: details.stabilityScore  ?? 5,  max: 10, prevKey: 'stabilityScore'   },
        { label: "NOWOCZESNOŚĆ TABORU",       val: details.modernityScore  ?? 5,  max: 10, prevKey: 'modernityScore'   },
        { label: "KONKURENCYJNOŚĆ CEN",       val: details.priceScore      ?? 10, max: 20, prevKey: 'priceScore'       },
        { label: "% PRZEWIEZIONYCH VS POPYT", val: details.fillRateScore   ?? 10, max: 20, prevKey: 'fillRateScore'    },
        { label: "PRĘDKOŚĆ PRZEJAZDU",        val: details.speedScore      ?? 5,  max: 10, prevKey: 'speedScore'       },
        { label: "KOMFORT PRZEJAZDU",         val: details.comfortScore    ?? 5,  max: 10, prevKey: 'comfortScore'     },
    ];
    const totalScore    = subScores.reduce((sum, s) => sum + Math.min(s.val, s.max), 0);
    const prevTotalScore = prevDetails
        ? subScores.reduce((sum, s) => sum + Math.min(prevDetails[s.prevKey] ?? s.val, s.max), 0)
        : null;
    const globalMax       = subScores.reduce((sum, s) => sum + s.max, 0);
    const globalBarHeight = subScores.reduce((sum, s) => sum + Math.round((s.max / 20) * 10), 0);

    return (
        <>
            <div className={styles.sectionHeader}>
                <h2>Polityka Firmy</h2>
                <p>Definiuj tożsamość i kierunki rozwoju swojej korporacji.</p>
            </div>
            <div className={styles.grid}>
                <section className={styles.card} style={{ background: 'rgba(10, 30, 10, 0.5)', border: '1px solid rgba(46,204,113,0.3)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ width: '80%', height: '220px', background: 'rgba(13,26,13,0.6)', borderRadius: '24px', border: '1px solid rgba(46,204,113,0.3)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            <img 
                                src={playerDoc?.logoUrl || "/wolfrail-logo.png"} 
                                alt="Company Logo" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', width: '100%' }}>
                            <div style={{ width: '100%' }}>
                                <label style={{ fontSize: '10px', color: '#8aab8a', letterSpacing: '2px', fontWeight: 'bold' }}>NAZWA OPERATORA</label>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff', borderBottom: '1px solid rgba(46,204,113,0.2)', paddingBottom: '8px', marginTop: '4px' }}>
                                    {companyName || 'Nieustalona'}
                                </div>
                            </div>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                style={{ display: 'none' }} 
                                accept="image/*"
                            />
                            
                            <button 
                                onClick={() => fileInputRef.current.click()}
                                disabled={uploading}
                                style={{ 
                                    background: 'none', 
                                    border: 'none',
                                    color: '#8aab8a',
                                    fontSize: '11px', 
                                    padding: '5px 10px', 
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    opacity: uploading ? 0.5 : 0.8,
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    marginTop: '5px',
                                    transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.opacity = '1'}
                                onMouseLeave={(e) => e.target.style.opacity = '0.8'}
                            >
                                {uploading ? 'Wgrywanie...' : 'Edytuj Branding'}
                            </button>
                        </div>
                    </div>
                </section>

                <section className={styles.card} style={{ background: 'rgba(10, 30, 10, 0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', height: 'fit-content' }}>
                    <h3 style={{ fontSize: '16px', color: '#f1c40f', marginBottom: '20px' }}>Wskaźniki Reputacji (Trust-Score)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <ReputationBar label="WSKAŹNIK REPUTACJI (GLOBALNY)" value={totalScore} max={globalMax} color="#2ecc71" barHeight={globalBarHeight} decimals={1} prevValue={prevTotalScore} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                            {subScores.map(s => (
                                <ReputationBar key={s.label} label={s.label} value={s.val} max={s.max} color="#f1c40f" prevValue={prevDetails ? (prevDetails[s.prevKey] ?? null) : null} />
                            ))}
                        </div>
                    </div>
                </section>
                
                <section className={styles.card}>
                    <h3>Strategia Cenowa</h3>
                    <div className={styles.statsGrid}>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Kl. 1 (100km)</span>
                            <span className={styles.statValue}>{defaultPricing.class1Per100km} PLN</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Kl. 2 (100km)</span>
                            <span className={styles.statValue}>{defaultPricing.class2Per100km} PLN</span>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
};

export default PolicySection;
