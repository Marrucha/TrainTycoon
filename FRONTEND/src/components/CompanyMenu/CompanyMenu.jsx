import { useState, useMemo, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import styles from './CompanyMenu.module.css';

import PolicySection from './sections/PolicySection';
import HRSection from './sections/HRSection';
import FinanceSection from './sections/FinanceSection';
import FleetSection from './sections/FleetSection';
import ShopSection from './sections/ShopSection';
import HallOfFame from './sections/HallOfFame';
import PolandMap from '../Map/PolandMap';
import Sidebar from '../Sidebar/Sidebar';
import FleetAssets from '../FleetMenu/FleetAssets';
import FleetCompositions from '../FleetMenu/FleetCompositions';
import ReportsMenu from '../Reports/ReportsMenu';
import Chat from '../Chat/Chat';

const NAV = [
  { id: 'policy', label: 'Firma', icon: '📋' },
  { id: '__sep__', label: '', icon: '' },
  { id: 'map', label: 'Mapa Sieci', icon: '🗺️' },
  {
    id: 'fleet-group', label: 'Flota Pociągów', icon: '🚃',
    children: [
      { id: 'fleet', label: 'Stan Taboru', icon: '🔧' },
      { id: 'fleet-assets', label: 'Elementy Floty', icon: '🚂' },
      { id: 'fleet-compositions', label: 'Zarządzanie flotą', icon: '🔗' },
    ],
  },
  { id: 'reports', label: 'Raporty', icon: '📊' },
  { id: '__sep2__', label: '', icon: '' },
  { id: 'finance', label: 'Finanse', icon: '💰' },
  { id: 'hr', label: 'Kadry', icon: '👥' },
  { id: '__sep3__', label: '', icon: '' },
  { id: 'shop', label: 'Sklep Premium', icon: '🛒' },
  { id: 'hall-of-fame', label: 'Hall of Fame', icon: '🏆' },
  { id: '__sep4__', label: '', icon: '' },
  { id: 'chat', label: 'Chat', icon: '💬' },
]

export default function CompanyMenu() {
  const {
    budget, reputation, companyName,
    trains, baseTrains, trainsSets,
    defaultPricing, performMaintenance,
    pictures, playerDoc,
    openCreditLine, takeLoan,
    deposits, depositRates, openDeposit, redeemDeposit, breakDeposit,
    gameDate: now,
  } = useGame();

  const [activeTab, setActiveTab] = useState('policy');
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState({ 'fleet-group': true });
  const [sortOrder, setSortOrder] = useState('desc');
  const [groupBy, setGroupBy] = useState('type');
  const [expandedGroups, setExpandedGroups] = useState({});
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
      if (typeof obj === 'object' && obj !== null) url = isLandscape ? (obj.url2 || obj.url) : obj.url;
      else if (typeof obj === 'string') url = obj;
    }
    return url;
  };

  const lokomotywowniaUrl = useMemo(() => getBackgroundUrl('Lokomotywownia'), [pictures, isLandscape]);
  const lokomotywowniaWnUrl = useMemo(() => getBackgroundUrl('Lokomotywownia_wnetrze'), [pictures, isLandscape]);
  const bankUrl = useMemo(() => getBackgroundUrl('Bank'), [pictures, isLandscape]);
  const kadryUrl = useMemo(() => getBackgroundUrl('Kadry'), [pictures, isLandscape]);
  const salonUrl = useMemo(() => getBackgroundUrl('Salon'), [pictures, isLandscape]);
  const raportyUrl = useMemo(() => getBackgroundUrl('Raporty'), [pictures, isLandscape]);
  const hallOfFameUrl = useMemo(() => getBackgroundUrl('HallOfFame'), [pictures, isLandscape]);
  const tloUrl = useMemo(() => getBackgroundUrl('Tlo'), [pictures, isLandscape]);

  const toggleGroup = (groupId) =>
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));

  // Zaokrąglenie do pełnej godziny gry — memo przelicza się raz/godzinę gry, nie co sekundę
  const nowMs = now ? Math.floor(now.getTime() / (3600 * 1000)) * (3600 * 1000) : null

  const fleetData = useMemo(() => {
    if (!nowMs) return []
    const analyzedTrains = trains.map(t => {
      const purchaseMs   = t.purchasedAt   ? new Date(t.purchasedAt).getTime()   : null
      const lastMainMs   = t.lastMaintenance ? new Date(t.lastMaintenance).getTime() : purchaseMs
      const lastOverMs   = t.lastOverhaul   ? new Date(t.lastOverhaul).getTime()   : purchaseMs
      const ageYears     = purchaseMs != null ? (nowMs - purchaseMs)   / (1000 * 60 * 60 * 24 * 365) : null
      const timeSinceMainDays  = lastMainMs != null ? (nowMs - lastMainMs) / (1000 * 60 * 60 * 24)        : 0
      const timeSinceOverYears = lastOverMs != null ? (nowMs - lastOverMs) / (1000 * 60 * 60 * 24 * 365) : 0
      const isMaintenance = timeSinceMainDays >= 365 && timeSinceMainDays < 368;
      const isOverhaul = timeSinceOverYears >= 10 && timeSinceOverYears < 10.083;
      let status = 'READY';
      if (isOverhaul) status = 'OVERHAUL';
      else if (isMaintenance) status = 'MAINTENANCE';
      const condition = Math.round(Math.max(0, 100 - (timeSinceOverYears / 10) * 40));
      return { ...t, ageYears: ageYears != null ? ageYears.toFixed(1) : null, condition, status };
    });

    if (groupBy === 'set') {
      const groups = trainsSets.map(ts => {
        const members = analyzedTrains.filter(t => ts.trainIds?.includes(t.id));
        let setStatus = 'READY';
        if (members.some(m => m.status === 'OVERHAUL')) setStatus = 'OVERHAUL';
        else if (members.some(m => m.status === 'MAINTENANCE')) setStatus = 'MAINTENANCE';
        const avgCondition = members.length ? Math.round(members.reduce((sum, m) => sum + m.condition, 0) / members.length) : 100;
        const minCondition = members.length ? Math.min(...members.map(m => m.condition)) : 100;
        return { id: ts.id, name: `${ts.name} [${members.length} szt.]`, type: ts.type, status: setStatus, condition: avgCondition, minCondition, members, isGroup: true };
      });
      const assignedIds = new Set(trainsSets.flatMap(ts => ts.trainIds || []));
      const unassigned = analyzedTrains.filter(t => !assignedIds.has(t.id));
      if (unassigned.length > 0) {
        const typeGroups = {};
        unassigned.forEach(t => {
          const key = t.type || 'Inne';
          if (!typeGroups[key]) typeGroups[key] = [];
          typeGroups[key].push(t);
        });
        Object.entries(typeGroups).forEach(([key, members]) => {
          const avgCondition = Math.round(members.reduce((s, m) => s + m.condition, 0) / members.length);
          const minCondition = Math.min(...members.map(m => m.condition));
          let status = 'READY';
          if (members.some(m => m.status === 'OVERHAUL')) status = 'OVERHAUL';
          else if (members.some(m => m.status === 'MAINTENANCE')) status = 'MAINTENANCE';
          groups.push({ id: `free_${key}`, name: `${key} [wolne, ${members.length} szt.]`, type: key, status, condition: avgCondition, minCondition, members, isGroup: true });
        });
      }
      return groups.sort((a, b) => sortOrder === 'desc' ? b.condition - a.condition : a.condition - b.condition);
    } else if (groupBy === 'type') {
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
        return { ...g, name: `${g.name} [${g.members.length} szt.]`, condition: avgCondition, minCondition, status: groupStatus, isGroup: true, members: g.members.sort((a, b) => sortOrder === 'desc' ? b.condition - a.condition : a.condition - b.condition) };
      }).sort((a, b) => sortOrder === 'desc' ? b.condition - a.condition : a.condition - b.condition);
    } else {
      // 'detail' — flat sorted list
      return analyzedTrains.sort((a, b) => sortOrder === 'desc' ? b.condition - a.condition : a.condition - b.condition);
    }
  }, [trains, trainsSets, sortOrder, groupBy, nowMs]);

  const bgImage = (() => {
    const url =
      activeTab === 'fleet' ? lokomotywowniaUrl :
        activeTab === 'fleet-compositions' ? lokomotywowniaWnUrl :
          activeTab === 'finance' ? bankUrl :
            activeTab === 'hr' ? kadryUrl :
              activeTab === 'fleet-assets' ? salonUrl :
                activeTab === 'reports' ? raportyUrl :
                  activeTab === 'shop' ? bankUrl :
                    activeTab === 'hall-of-fame' ? hallOfFameUrl :
                      activeTab === 'policy' ? tloUrl : null;
    if (!url) return 'none';
    return `linear-gradient(rgba(6, 15, 6, 0.45), rgba(6, 15, 6, 0.45)), url("${url}")`;
  })();

  const isMgmtTab = ['policy', 'hr', 'finance', 'fleet'].includes(activeTab);
  const isFullTab = ['map', 'fleet-assets', 'fleet-compositions', 'reports', 'chat'].includes(activeTab);

  return (
    <div
      className={styles.companyMenu}
      style={{
        backgroundImage: bgImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundColor: '#060f06',
      }}
    >
      {/* ── Sidebar ── */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${Object.values(openGroups).some(v => v) ? (collapsed ? styles.sidebarCollapsedWide : styles.sidebarWide) : ''}`}>
        <div className={styles.sidebarHeader}>
          {!collapsed && <span className={styles.sidebarTitle}>Menu Managera</span>}
          <button className={styles.collapseBtn} onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {NAV.map(item => {
          if (item.id.startsWith('__sep')) return (
            <div key={item.id} className={`${styles.navSep} ${collapsed ? styles.navSepCollapsed : ''}`} />
          );

          if (item.children) {
            const isOpen = openGroups[item.id];
            const childActive = item.children.some(c => c.id === activeTab);
            return (
              <div key={item.id}>
                <div
                  className={`${styles.navItem} ${childActive && isOpen ? styles.activeNavItem : ''} ${isOpen ? styles.navGroupOpen : ''}`}
                  onClick={() => setOpenGroups(p => ({ ...p, [item.id]: !p[item.id] }))}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!collapsed && <><span className={styles.navLabel}>{item.label}</span><span className={styles.navArrow}>{isOpen ? '▾' : '▸'}</span></>}
                </div>
                {isOpen && item.children.map(child => (
                  <div
                    key={child.id}
                    className={`${styles.navItem} ${styles.navChild} ${activeTab === child.id ? styles.activeNavItem : ''} ${collapsed ? styles.navChildCollapsed : ''}`}
                    onClick={() => setActiveTab(child.id)}
                    title={collapsed ? child.label : undefined}
                  >
                    <span className={styles.navIcon}>{child.icon}</span>
                    {!collapsed && <span className={styles.navLabel}>{child.label}</span>}
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={`${styles.navItem} ${activeTab === item.id ? styles.activeNavItem : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </div>
          );
        })}
      </aside>

      {/* ── Content ── */}
      <div className={isFullTab ? styles.contentFull : styles.content}>
        {activeTab === 'map' && <><section className={styles.mapSection}><PolandMap /></section><Sidebar /></>}
        {activeTab === 'fleet-assets' && <FleetAssets />}
        {activeTab === 'fleet-compositions' && <FleetCompositions />}
        {activeTab === 'reports' && <ReportsMenu />}
        {activeTab === 'shop' && <ShopSection />}
        {activeTab === 'hall-of-fame' && <HallOfFame />}
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'policy' && <PolicySection companyName={companyName} defaultPricing={defaultPricing} reputation={reputation} playerDoc={playerDoc} />}
        {activeTab === 'hr' && <HRSection />}
        {activeTab === 'finance' && (
          <FinanceSection
            budget={budget} reputation={reputation} playerDoc={playerDoc}
            trains={trains} baseTrains={baseTrains}
            openCreditLine={openCreditLine} takeLoan={takeLoan}
            toggleGroup={toggleGroup} expandedGroups={expandedGroups}
            deposits={deposits} depositRates={depositRates}
            openDeposit={openDeposit} redeemDeposit={redeemDeposit} breakDeposit={breakDeposit}
          />
        )}
        {activeTab === 'fleet' && (
          <FleetSection
            fleetData={fleetData} groupBy={groupBy} setGroupBy={setGroupBy}
            sortOrder={sortOrder} setSortOrder={setSortOrder}
            expandedGroups={expandedGroups} toggleGroup={toggleGroup}
            performMaintenance={performMaintenance}
          />
        )}
      </div>
    </div>
  );
}
