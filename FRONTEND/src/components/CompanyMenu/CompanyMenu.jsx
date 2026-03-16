import { useState, useMemo, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import styles from './CompanyMenu.module.css';

export default function CompanyMenu() {
  const {
    budget,
    reputation,
    companyName,
    trains,
    trainsSets,
    defaultPricing,
    performMaintenance,
    pictures
  } = useGame();

  const [activeSection, setActiveSection] = useState('fleet');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [groupBy, setGroupBy] = useState('set'); // 'set' or 'type'
  const [expandedGroups, setExpandedGroups] = useState({}); // Tracking expanded state
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getBackgroundUrl = (imageName) => {
    if (!pictures) return null;

    const searchInData = (data) => {
      if (!data) return null;
      const items = Array.isArray(data) ? data : Object.values(data);
      const found = items.find(v => v && (v.name === imageName || v.id === imageName));
      if (!found) return null;
      const rawUrl = isLandscape ? (found.url2 || found.url) : found.url;
      return typeof rawUrl === 'string' ? rawUrl.trim() : rawUrl;
    };

    let url = searchInData(pictures);
    if (!url) url = searchInData(pictures.picture);
    if (!url) url = searchInData(pictures.views);
    if (!url) {
      const obj = pictures[imageName];
      if (typeof obj === 'object' && obj !== null) {
        url = isLandscape ? (obj.url2 || obj.url) : obj.url;
      } else if (typeof obj === 'string') {
        url = obj;
      }
    }
    return url;
  };

  const lokomotywowniaUrl = useMemo(() => getBackgroundUrl('Lokomotywownia'), [pictures, isLandscape]);
  const bankUrl = useMemo(() => getBackgroundUrl('Bank'), [pictures, isLandscape]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Logic for Fleet Condition with cascading status
  const fleetData = useMemo(() => {
    // ... analyzedTrains calculation remains same ...
    const analyzedTrains = trains.map(t => {
      const purchaseDate = t.purchasedAt ? new Date(t.purchasedAt) : new Date();
      const lastMainDate = t.lastMaintenance ? new Date(t.lastMaintenance) : purchaseDate;
      const lastOverDate = t.lastOverhaul ? new Date(t.lastOverhaul) : purchaseDate;
      const now = new Date();
      const ageYears = (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365);
      const timeSinceMainDays = (now - lastMainDate) / (1000 * 60 * 60 * 24);
      const timeSinceOverYears = (now - lastOverDate) / (1000 * 60 * 60 * 24 * 365);
      const isMaintenance = timeSinceMainDays >= 365 && timeSinceMainDays < 368;
      const isOverhaul = timeSinceOverYears >= 10 && timeSinceOverYears < 10.083;
      let status = 'READY';
      if (isOverhaul) status = 'OVERHAUL';
      else if (isMaintenance) status = 'MAINTENANCE';
      const condition = Math.round(Math.max(0, 100 - (timeSinceOverYears / 10) * 40));
      return { ...t, ageYears: ageYears.toFixed(1), condition, status };
    });

    if (groupBy === 'set') {
      const groups = trainsSets.map(ts => {
        const members = analyzedTrains.filter(t => ts.trainIds?.includes(t.id));
        let setStatus = 'READY';
        if (members.some(m => m.status === 'OVERHAUL')) setStatus = 'OVERHAUL';
        else if (members.some(m => m.status === 'MAINTENANCE')) setStatus = 'MAINTENANCE';
        const avgCondition = members.length ? Math.round(members.reduce((sum, m) => sum + m.condition, 0) / members.length) : 100;
        const minCondition = members.length ? Math.min(...members.map(m => m.condition)) : 100;

        return {
          id: ts.id,
          name: `${ts.name} [${members.length} szt.]`,
          type: ts.type,
          status: setStatus,
          condition: avgCondition,
          minCondition,
          members,
          isGroup: true // New flag for UI layout
        };
      });

      const assignedIds = new Set(trainsSets.flatMap(ts => ts.trainIds || []));
      const unassigned = analyzedTrains.filter(t => !assignedIds.has(t.id)).map(t => ({
        id: t.id,
        name: `${t.name} [1 szt.]`,
        type: 'WOLNY ELEMENT',
        status: t.status,
        condition: t.condition,
        minCondition: t.condition,
        members: [t],
        isGroup: false
      }));

      const combined = [...groups, ...unassigned];
      return combined.sort((a, b) => sortOrder === 'desc' ? b.condition - a.condition : a.condition - b.condition);
    } else {
      const typeGroups = {};
      analyzedTrains.forEach(t => {
        const typeKey = t.type || 'Inne';
        if (!typeGroups[typeKey]) typeGroups[typeKey] = { id: typeKey, name: typeKey, members: [], condition: 0, status: 'READY' };
        typeGroups[typeKey].members.push(t);
      });

      return Object.values(typeGroups).map(g => {
        const avgCondition = Math.round(g.members.reduce((sum, m) => sum + m.condition, 0) / g.members.length);
        const minCondition = Math.min(...g.members.map(m => m.condition));
        let groupStatus = 'READY';
        if (g.members.some(m => m.status === 'OVERHAUL')) groupStatus = 'OVERHAUL';
        else if (g.members.some(m => m.status === 'MAINTENANCE')) groupStatus = 'MAINTENANCE';

        return {
          ...g,
          name: `${g.name} [${g.members.length} szt.]`,
          condition: avgCondition,
          minCondition,
          status: groupStatus,
          isGroup: true,
          members: g.members.sort((a, b) => sortOrder === 'desc' ? b.condition - a.condition : a.condition - b.condition)
        };
      }).sort((a, b) => sortOrder === 'desc' ? b.condition - a.condition : a.condition - b.condition);
    }
  }, [trains, trainsSets, sortOrder, groupBy]);

  const renderPolicy = () => (
    <>
      <div className={styles.sectionHeader}>
        <h2>Polityka Firmy</h2>
        <p>Definiuj tożsamość i kierunki rozwoju swojej korporacji.</p>
      </div>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h3>Profil Korporacyjny</h3>
          <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
            <div style={{ width: '240px', height: '240px', background: '#0d1a0d', borderRadius: '24px', border: '2px solid #2a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '20px' }}>
              <img src="/wolfrail-logo.png" alt="WolfRail Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '9px', color: '#666', letterSpacing: '1px' }}>NAZWA OPERATORA</label>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>{companyName || 'Nieustalona'}</div>
              </div>
              <button className={styles.saveBtn} style={{ background: '#2c3e50', margin: 0, fontSize: '10px', padding: '6px 12px' }}>Edytuj Branding</button>
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

  const renderHR = () => (
    <>
      <div className={styles.sectionHeader}>
        <h2>Kadry (HR)</h2>
        <p>Zarządzaj zespołem maszynistów, konduktorów i personelu technicznego.</p>
      </div>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h3>Zatrudnienie</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Pracownicy ogółem</span>
              <span className={styles.statValue}>124</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Wakatów</span>
              <span className={styles.statValue}>12</span>
            </div>
          </div>
        </section>
        <section className={styles.card}>
          <h3>Wydajność Zespołu</h3>
          <div style={{ height: '10px', background: '#000', borderRadius: '5px', marginTop: '10px', overflow: 'hidden' }}>
            <div style={{ width: '85%', height: '100%', background: '#f1c40f' }}></div>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Średni poziom zadowolenia: 85%</p>
        </section>
      </div>
    </>
  );

  const renderFinance = () => (
    <>
      <div className={styles.sectionHeader}>
        <h2>Finanse</h2>
        <p>Analizuj przepływy pieniężne i rentowność połączeń.</p>
      </div>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h3>Bilans</h3>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Środki Operacyjne</span>
            <span className={styles.statValue} style={{ color: '#2ecc71', fontSize: '32px' }}>
              {Math.round(budget).toLocaleString()} PLN
            </span>
          </div>
        </section>
        <section className={styles.card}>
          <h3>Reputacja Rynkowa</h3>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Rating Trust-Score</span>
            <span className={styles.statValue} style={{ color: '#f1c40f' }}>
              {(reputation * 100).toFixed(1)}%
            </span>
          </div>
        </section>
      </div>

      <div className={styles.sectionHeader} style={{ marginTop: '30px' }}>
        <h2>Sektor Bankowy</h2>
        <p>Zarządzaj kredytami, lokatami i akcjami swojej firmy.</p>
      </div>

      <div className={styles.grid}>
        {/* Kredyty i Linie Kredytowe */}
        <section className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3>Instrumenty Dłużne</h3>
            <span style={{ fontSize: '12px', color: '#666' }}>Zdolność: 5.000.000 PLN</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Linia Kredytowa</span>
                <span style={{ fontSize: '13px', color: '#888' }}>Oprocentowanie: 5.5%</span>
              </div>
              <button className={styles.saveBtn} style={{ width: '100%', padding: '8px', fontSize: '11px', margin: '5px 0 0 0' }}>Otwórz Linię</button>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Kredyt Inwestycyjny</span>
                <span style={{ fontSize: '13px', color: '#888' }}>Max: 10 mln PLN</span>
              </div>
              <button className={styles.saveBtn} style={{ width: '100%', padding: '8px', fontSize: '11px', margin: '5px 0 0 0', background: '#e67e22' }}>Weź Kredyt</button>
            </div>
          </div>
        </section>

        {/* Lokaty i Depozyty */}
        <section className={styles.card}>
          <h3>Depozyty i Lokaty</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '5px' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Lokata Terminowa (30 dni)</span>
                <span style={{ fontSize: '13px', color: '#2ecc71' }}>Zysk: +2.5%</span>
              </div>
              <button className={styles.saveBtn} style={{ width: '100%', padding: '8px', fontSize: '11px', margin: '5px 0 0 0', background: '#27ae60' }}>Załóż Lokatę</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>ŚRODKI ZABLOKOWANE:</span>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>0 PLN</span>
            </div>
          </div>
        </section>

        {/* Zarządzanie Akcjami (GPW) */}
        <section className={styles.card} style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Giełda Papierów Wartościowych</h3>
              <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#666' }}>Zarządzaj kapitałem własnym i przejmuj dominację na rynku.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#2ecc71' }}>142.50 PLN</div>
              <div style={{ fontSize: '11px', color: '#666' }}>KURS TWOICH AKCJI (+2.4%)</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4>Twoje Udziały</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: '#777' }}>Pakiet Kontrolny:</span>
                <span style={{ fontSize: '12px', fontWeight: '700' }}>51.0%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: '#777' }}>Kapitalizacja:</span>
                <span style={{ fontSize: '12px', fontWeight: '700' }}>1.425.000.000 PLN</span>
              </div>
              <button className={styles.saveBtn} style={{ background: '#27ae60', margin: '10px 0 0 0', fontWeight: '700' }}>Emituj Nowe Akcje</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4>Rynek Konkurencji</h4>
              {[
                { name: 'RailWay Star', price: '89.20', trend: '-1.2%', color: '#e74c3c' },
                { name: 'EcoTrain Ltd', price: '210.45', trend: '+0.8%', color: '#2ecc71' }
              ].map(comp => (
                <div key={comp.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px', border: '1px solid rgba(42, 74, 42, 0.3)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>{comp.name}</span>
                    <span style={{ fontSize: '10px', color: comp.color }}>{comp.price} PLN ({comp.trend})</span>
                  </div>
                  <button className={styles.saveBtn} style={{ padding: '5px 12px', fontSize: '10px', background: 'transparent', border: '1px solid #f0c040', color: '#f0c040', margin: 0 }}>Kup</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );

  const renderFleet = () => (
    <>
      <div className={styles.sectionHeader} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '15px' }}>
        <div>
          <h2>Stan Taboru</h2>
          <p>Monitoring techniczny i harmonogram remontów Twojej floty.</p>
        </div>

        {/* Controls Line */}
        <div style={{ display: 'flex', gap: '8px', width: '100%', background: 'rgba(0,20,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid #2a4a2a' }}>
          <div style={{ display: 'flex', background: '#0a150a', padding: '3px', borderRadius: '6px', marginRight: '15px', border: '1px solid #2a4a2a' }}>
            <button
              className={styles.saveBtn}
              style={{ background: groupBy === 'set' ? '#2a4a2a' : 'transparent', color: groupBy === 'set' ? '#f0c040' : '#8aab8a', padding: '6px 12px', fontSize: '11px', margin: 0, height: '30px' }}
              onClick={() => setGroupBy('set')}
            >
              Wg Składów
            </button>
            <button
              className={styles.saveBtn}
              style={{ background: groupBy === 'type' ? '#2a4a2a' : 'transparent', color: groupBy === 'type' ? '#f0c040' : '#8aab8a', padding: '6px 12px', fontSize: '11px', margin: 0, height: '30px' }}
              onClick={() => setGroupBy('type')}
            >
              Wg Typu
            </button>
          </div>

          <div style={{ display: 'flex', background: '#0a150a', padding: '3px', borderRadius: '6px', border: '1px solid #2a4a2a' }}>
            <button
              className={styles.saveBtn}
              style={{ background: sortOrder === 'desc' ? '#2a4a2a' : 'transparent', border: sortOrder === 'desc' ? '1px solid #f0c040' : 'none', color: sortOrder === 'desc' ? '#f0c040' : '#8aab8a', padding: '0 15px', fontSize: '11px', margin: 0, height: '30px', display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={() => setSortOrder('desc')}
            >
              Sprawność ↓
            </button>
            <button
              className={styles.saveBtn}
              style={{ background: sortOrder === 'asc' ? '#2a4a2a' : 'transparent', border: sortOrder === 'asc' ? '1px solid #f0c040' : 'none', color: sortOrder === 'asc' ? '#f0c040' : '#8aab8a', padding: '0 15px', fontSize: '11px', margin: 0, height: '30px', display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={() => setSortOrder('asc')}
            >
              Sprawność ↑
            </button>
          </div>
        </div>
      </div>

      <div className={styles.taborList}>
        {fleetData.map(group => {
          const isExpanded = expandedGroups[group.id];
          return (
            <div key={group.id} className={styles.card} style={{ padding: '0', overflow: 'hidden', borderLeft: `6px solid ${group.status === 'READY' ? '#2ecc71' : (group.status === 'MAINTENANCE' ? '#f1c40f' : '#e74c3c')}` }}>
              {/* Header: Pure Set Name/Type */}
              <div
                style={{ padding: '12px 20px', background: 'rgba(0,30,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: isExpanded ? '1px solid #2a4a2a' : 'none' }}
                onClick={() => toggleGroup(group.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#666', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {group.name}
                  </div>
                </div>
                <div className={styles.taborStatus}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {group.isGroup ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span className={styles.statLabel} style={{ fontSize: '9px' }}>ŚREDNIA SPRAWNOŚĆ</span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{group.condition}%</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderLeft: '1px solid #333', paddingLeft: '15px' }}>
                          <span className={styles.statLabel} style={{ fontSize: '9px' }}>MINIMALNA SPRAWNOŚĆ</span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: group.minCondition > 65 ? '#fff' : '#e74c3c' }}>{group.minCondition}%</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span className={styles.statLabel} style={{ fontSize: '9px' }}>SPRAWNOŚĆ</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: group.condition > 65 ? '#fff' : '#e74c3c' }}>{group.condition}%</span>
                      </div>
                    )}
                    {group.status === 'READY' && <span className={`${styles.badge} ${styles.badgeReady}`}>Operacyjny</span>}
                    {group.status === 'MAINTENANCE' && <span className={`${styles.badge} ${styles.badgeService}`}>Serwis</span>}
                    {group.status === 'OVERHAUL' && <span className={`${styles.badge} ${styles.badgeRepair}`}>Remont</span>}
                    {group.isGroup && group.members.length > 0 && (
                      <button
                        className={styles.saveBtn}
                        style={{
                          padding: '6px 14px',
                          fontSize: '10px',
                          background: 'transparent',
                          border: '1px solid #f0c040',
                          color: '#f0c040',
                          margin: 0,
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          marginLeft: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Czy na pewno przeprowadzić konserwację wszystkich elementów składu ${group.name}?`)) {
                            group.members.forEach(m => performMaintenance(m.id));
                          }
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>🛠</span> Konserwacja Składu
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Elements list directly below, collapsible */}
              {isExpanded && (
                <div style={{ padding: '5px 15px 15px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,10,0,0.1)' }}>
                  {group.members.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'rgba(13,26,13,0.3)', borderRadius: '4px', border: '1px solid #2a4a2a' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#eee' }}>{m.name}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '3px' }}>
                          <span style={{ fontSize: '11px', background: '#060f06', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', color: '#f0c040' }}>
                            {m.ageYears} lat
                          </span>
                          <span style={{ fontSize: '11px', color: '#8aab8a' }}>| Typ: {m.type}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: m.condition > 80 ? '#2ecc71' : (m.condition > 65 ? '#f1c40f' : '#e74c3c') }}>
                          {m.condition}%
                        </span>
                        <button
                          className={styles.saveBtn}
                          style={{ padding: '5px 12px', fontSize: '10px', background: '#0a150a', border: '1px solid #2a4a2a', color: '#8aab8a', margin: 0, textTransform: 'uppercase' }}
                          onClick={(e) => { e.stopPropagation(); performMaintenance(m.id); }}
                        >
                          Konserwacja
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div
      className={styles.companyMenu}
      style={{
        backgroundImage: activeSection === 'fleet' && lokomotywowniaUrl
          ? `linear-gradient(rgba(6, 15, 6, 0.45), rgba(6, 15, 6, 0.45)), url("${lokomotywowniaUrl}")`
          : activeSection === 'finance' && bankUrl
            ? `linear-gradient(rgba(6, 15, 6, 0.45), rgba(6, 15, 6, 0.45)), url("${bankUrl}")`
            : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'scroll',
        backgroundColor: '#060f06'
      }}
    >
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Menu Managera</div>
        <div
          className={`${styles.navItem} ${activeSection === 'policy' ? styles.activeNavItem : ''}`}
          onClick={() => setActiveSection('policy')}
        >
          <span>📋</span> Polityka Firmy
        </div>
        <div
          className={`${styles.navItem} ${activeSection === 'hr' ? styles.activeNavItem : ''}`}
          onClick={() => setActiveSection('hr')}
        >
          <span>👥</span> Kadry
        </div>
        <div
          className={`${styles.navItem} ${activeSection === 'finance' ? styles.activeNavItem : ''}`}
          onClick={() => setActiveSection('finance')}
        >
          <span>💰</span> Finanse
        </div>
        <div
          className={`${styles.navItem} ${activeSection === 'fleet' ? styles.activeNavItem : ''}`}
          onClick={() => setActiveSection('fleet')}
        >
          <span>🚂</span> Stan Taboru
        </div>
      </aside>

      <main
        className={styles.content}
      >
        {activeSection === 'policy' && renderPolicy()}
        {activeSection === 'hr' && renderHR()}
        {activeSection === 'finance' && renderFinance()}
        {activeSection === 'fleet' && renderFleet()}
      </main>
    </div>
  );
}
