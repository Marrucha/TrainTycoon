import React from 'react'
import styles from '../PolandMap.module.css'

export function MapControls({
    map,
    hoverHighlightActiveRoutes,
    setHoverHighlightActiveRoutes
}) {
    return (
        <div className={styles.zoomControls}>
            <button
                className={styles.zoomBtn}
                style={{
                    width: 'auto',
                    padding: '0 8px',
                    fontSize: '11px',
                    gap: '4px',
                    border: hoverHighlightActiveRoutes ? '1px solid #f0c040' : undefined,
                    color: hoverHighlightActiveRoutes ? '#f0c040' : undefined
                }}
                onMouseEnter={() => setHoverHighlightActiveRoutes(true)}
                onMouseLeave={() => setHoverHighlightActiveRoutes(false)}
                title="Podświetl aktywną sieć"
            >
                <span style={{ fontSize: '14px' }}>🌐</span> SIEĆ
            </button>
            <button className={styles.zoomBtn} onClick={() => map.setZoom(map.getZoom() + 1)} title="Przybliż">+</button>
            <button className={styles.zoomBtn} onClick={() => map.setZoom(map.getZoom() - 1)} title="Oddal">−</button>
            <button className={styles.zoomBtn} onClick={() => map.setView([52.0, 19.5], 6)} title="Reset">⌂</button>
        </div>
    )
}
