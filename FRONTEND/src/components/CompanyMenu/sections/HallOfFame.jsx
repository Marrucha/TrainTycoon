import { useGame } from '../../../context/GameContext'
import styles from './HallOfFame.module.css'

export default function HallOfFame() {
  const { hallOfFame } = useGame()

  if (!hallOfFame || Object.keys(hallOfFame).length === 0) {
    return <div className={styles.loading}>Zbieranie danych dla rankingu lub brak zapisów z serwera...</div>
  }

  const renderRanking = (title, key, formatter = (v) => v) => {
    const list = hallOfFame[key] || []
    if (list.length === 0) {
      return (
        <div className={styles.rankingBox}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.loading} style={{ height: '40px', fontSize: 12 }}>Pusto</div>
        </div>
      )
    }
    return (
      <div className={styles.rankingBox}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.list}>
          {list.map((item, idx) => (
            <div key={item.pid} className={`${styles.row} ${idx < 3 ? styles[`top${idx+1}`] : ''}`}>
              <span className={styles.pos}>{idx + 1}.</span>
              <span className={styles.name}>{item.name.substring(0, 20)}</span>
              <span className={styles.val}>{formatter(item.val)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>🏆 Aleja Sław (Hall of Fame) 🏆</h2>
      <div className={styles.grid}>
        {renderRanking('Liczba Zestawów Floty', 'trains')}
        {renderRanking('Dzienny Przebieg', 'km', v => `${v.toLocaleString('pl-PL')} km`)}
        {renderRanking('Obsłużeni Pasażerowie', 'passengers', v => `${v.toLocaleString('pl-PL')} os.`)}
        {renderRanking('Całkowity Popyt', 'demand', v => `${v.toLocaleString('pl-PL')} os.`)}
        {renderRanking('Dzienny Przychód', 'revenue', v => `${v.toLocaleString('pl-PL')} PLN`)}
        {renderRanking('Dzienny Zysk Netto', 'profit', v => `${v.toLocaleString('pl-PL')} PLN`)}
      </div>

      <h2 className={styles.header} style={{ marginTop: '3rem' }}>📈 Odznaczenia Rozwojowe 📈</h2>
      <div className={styles.grid}>
        {renderRanking('Przyrost Popytu (1 dzień)', 'dem_grow_d', v => `${v > 0 ? '+' : ''}${v} os.`)}
        {renderRanking('Podbój Popytu (7 dni)', 'dem_grow_w', v => `${v > 0 ? '+' : ''}${v} os.`)}
        {renderRanking('Podbój Popytu (30 dni)', 'dem_grow_m', v => `${v > 0 ? '+' : ''}${v} os.`)}
        {renderRanking('Skok Przychodu (1 dzień)', 'rev_grow_d', v => `${v > 0 ? '+' : ''}${v.toLocaleString('pl-PL')} PLN`)}
        {renderRanking('Rozwój Przychodu (7 dni)', 'rev_grow_w', v => `${v > 0 ? '+' : ''}${v.toLocaleString('pl-PL')} PLN`)}
        {renderRanking('Rozwój Przychodu (30 dni)', 'rev_grow_m', v => `${v > 0 ? '+' : ''}${v.toLocaleString('pl-PL')} PLN`)}
      </div>

      <h2 className={styles.header} style={{ marginTop: '3rem' }}>💰 Magnaci Finansjery 💰</h2>
      <div className={styles.grid}>
        {renderRanking('Kapitał Własny (Gotówka)', 'equity', v => `${v.toLocaleString('pl-PL')} PLN`)}
        {renderRanking('Majątek Osobisty CEO', 'personal_wealth', v => `${v.toLocaleString('pl-PL')} PLN`)}
      </div>
      <div className={styles.footerInfo}>
        Ostatnia aktualizacja tablic: {new Date(hallOfFame.updatedAt).toLocaleString('pl-PL')}
      </div>
    </div>
  )
}
