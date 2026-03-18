import { useState, useMemo, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import styles from './CompanyMenu.module.css';

// Section Components
import PolicySection from './sections/PolicySection';
import HRSection from './sections/HRSection';
import FinanceSection from './sections/FinanceSection';
import FleetSection from './sections/FleetSection';

export default function CompanyMenu() {
  const {
    budget,
    reputation,
    companyName,
    trains,
    baseTrains,
    trainsSets,
    defaultPricing,
    performMaintenance,
    pictures,
    playerDoc,
    openCreditLine,
    takeLoan,
    deposits,
    depositRates,
    openDeposit,
    breakDeposit,
    emitShares,
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
  const kadryUrl = useMemo(() => getBackgroundUrl('Kadry'), [pictures, isLandscape]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Logic for Fleet Condition with cascading status
  const fleetData = useMemo(() => {
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
          isGroup: true
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

  return (
    <div
      className={styles.companyMenu}
      style={{
        backgroundImage: activeSection === 'fleet' && lokomotywowniaUrl
          ? `linear-gradient(rgba(6, 15, 6, 0.45), rgba(6, 15, 6, 0.45)), url("${lokomotywowniaUrl}")`
          : activeSection === 'finance' && bankUrl
            ? `linear-gradient(rgba(6, 15, 6, 0.45), rgba(6, 15, 6, 0.45)), url("${bankUrl}")`
            : activeSection === 'hr' && kadryUrl
              ? `linear-gradient(rgba(6, 15, 6, 0.45), rgba(6, 15, 6, 0.45)), url("${kadryUrl}")`
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

      <main className={styles.content}>
        {activeSection === 'policy' && (
          <PolicySection
            companyName={companyName}
            defaultPricing={defaultPricing}
          />
        )}
        {activeSection === 'hr' && <HRSection />}
        {activeSection === 'finance' && (
          <FinanceSection
            budget={budget}
            reputation={reputation}
            playerDoc={playerDoc}
            trains={trains}
            baseTrains={baseTrains}
            openCreditLine={openCreditLine}
            takeLoan={takeLoan}
            toggleGroup={toggleGroup}
            expandedGroups={expandedGroups}
            deposits={deposits}
            depositRates={depositRates}
            openDeposit={openDeposit}
            breakDeposit={breakDeposit}
            emitShares={emitShares}
          />
        )}
        {activeSection === 'fleet' && (
          <FleetSection
            fleetData={fleetData}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            performMaintenance={performMaintenance}
          />
        )}
      </main>
    </div>
  );
}
