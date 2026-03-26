import React, { useState } from 'react';
import { doc, setDoc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { INITIAL_BUDGET } from '../../data/gameData';
import styles from './Onboarding.module.css';

export default function Onboarding({ onComplete }) {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMigrate = async () => {
    try {
      setLoading(true);
      setError('');
      const uid = auth.currentUser.uid;
      
      const oldRef = doc(db, 'players', 'player1');
      const oldSnap = await getDoc(oldRef);
      
      if (!oldSnap.exists()) {
        setError('Brak zapisów testowych (player1) do przywrócenia.');
        setLoading(false);
        return;
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'players', uid), oldSnap.data(), { merge: true });

      const subColNames = ['trains', 'trainSet', 'kadry', 'deposits', 'financeLedger', 'Raporty'];
      
      for (let colName of subColNames) {
        const docs = await getDocs(collection(db, `players/player1/${colName}`));
        docs.forEach(d => {
            batch.set(doc(db, `players/${uid}/${colName}`, d.id), d.data());
        });
      }

      await batch.commit();
      
      if (onComplete) onComplete();
      // Opcjonalne przeładowanie, aby wymusić ponowne odczytanie wszystkich haków
      window.location.reload();
      
    } catch (err) {
      console.error(err);
      setError('Błąd podczas migracji danych z player1.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Nazwa firmy nie może być pusta!');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const uid = auth.currentUser.uid;
      
      await setDoc(doc(db, 'players', uid), {
        companyName: companyName.trim(),
        reputation: 0.5,
        finance: {
          balance: INITIAL_BUDGET || 250000000
        },
        defaultPricing: {
          class1Per100km: 10,
          class2Per100km: 6,
          multipliers: [1.0, 0.9, 0.8, 0.7, 0.65, 0.6]
        },
        createdAt: new Date().toISOString()
      }, { merge: true });

      if (onComplete) onComplete();
    } catch (err) {
      console.error(err);
      setError('Błąd podczas tworzenia firmy. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2>Witaj Nowy Dyrektorze!</h2>
        <p>Zanim rozpoczniesz budowę swojego kolejowego imperium, musisz zarejestrować swoją firmę.</p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Podaj nazwę swojej firmy:</label>
            <input 
              type="text" 
              value={companyName} 
              onChange={(e) => setCompanyName(e.target.value)} 
              placeholder="np. InterCity, PolRegio..."
              maxLength={30}
              autoFocus
            />
          </div>
          
          {error && <div className={styles.error}>{error}</div>}
          
          <button type="submit" disabled={loading || !companyName.trim()} className={styles.button}>
            {loading ? 'Przetwarzanie...' : 'Rozpocznij Nową Grę 🚂'}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a4a2a' }}>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            Grałeś już wcześniej w trybie testowym przed założeniem konta w Google?
          </p>
          <button 
            type="button" 
            onClick={handleMigrate} 
            disabled={loading} 
            style={{ 
              background: 'transparent', 
              border: '1px solid #f0c040', 
              color: '#f0c040', 
              padding: '10px 16px', 
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              width: '100%'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(240, 192, 64, 0.1)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            Przywróć mój postęp z gry (Import)
          </button>
        </div>
      </div>
    </div>
  );
}
