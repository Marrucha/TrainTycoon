import styles from '../RoutePanel.module.css'

export default function DemandMatrix({ mergedOD, stopOrder, cities }) {
  if (Object.keys(mergedOD).length === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>POPYT OD (pary miast / dobę)</div>
      <div className={styles.stats}>
        {Object.entries(mergedOD)
          .sort((a, b) => {
            const [af, at_] = a[0].split(':')
            const [bf, bt] = b[0].split(':')
            const afi = stopOrder[af] ?? 999
            const ati = stopOrder[at_] ?? 999
            const bfi = stopOrder[bf] ?? 999
            const bti = stopOrder[bt] ?? 999
            if (afi !== bfi) return afi - bfi
            return Math.abs(ati - afi) - Math.abs(bti - bfi)
          })
          .map(([key, val]) => {
            const [fromId, toId] = key.split(':')
            const fromName = cities?.find(c => c.id === fromId)?.name ?? fromId
            const toName = cities?.find(c => c.id === toId)?.name ?? toId
            
            const origC1 = val.dmC1 + val.trC1 + val.obC1;
            const origC2 = val.dmC2 + val.trC2 + val.obC2;
            const origTotal = origC1 + origC2;
            
            return (
              <div key={key} className={styles.statRow} style={{ borderBottom: '1px solid #1a2a1a', padding: '4px 0', alignItems: 'flex-start' }}>
                <span className={styles.statLabel} style={{ flex: 1, color: '#6a9a6a', paddingTop: 2 }}>{fromName} → {toName}</span>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ color: '#8aa88a', fontWeight: 'bold' }}>
                    {origTotal.toLocaleString('pl-PL')} os.
                    {origTotal > 0 && (
                      <span style={{ color: '#3a5a3a', fontSize: 9, marginLeft: 6 }}>
                        ({Math.round(((val.obC1 + val.obC2 + val.trC1 + val.trC2) / origTotal) * 100)}%)
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#6a8a6a', fontSize: 9, marginTop: 2 }}>
                    {[
                      origC1 > 0 ? `kl.1: ${origC1} os. (${Math.round(((val.obC1 + val.trC1) / origC1) * 100)}%)` : null,
                      origC2 > 0 ? `kl.2: ${origC2} os. (${Math.round(((val.obC2 + val.trC2) / origC2) * 100)}%)` : null
                    ].filter(Boolean).join(' | ')}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </section>
  )
}
