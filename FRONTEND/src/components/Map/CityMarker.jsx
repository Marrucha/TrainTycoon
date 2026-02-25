import { motion } from 'framer-motion'

const T1_CAPITAL_RADIUS = 10
const T1_RADIUS = 8
const T2_RADIUS = 6
const TOURIST_RADIUS = 5
const CROSSING_RADIUS = 5
const INT_RADIUS = 10

const T1_COLOR         = '#40a840'
const T1_CAPITAL_COLOR = '#80ff80'
const T2_COLOR         = '#40b0b0'
const TOURIST_COLOR    = '#f0d040'
const INT_COLOR        = '#607a60'

// Progi Leaflet zoom dla etykiet
const T2_LABEL_ZOOM       = 7
const TOURIST_LABEL_ZOOM  = 7
const CROSSING_LABEL_ZOOM = 9

export default function CityMarker({ city, cx, cy, isSelected, isHovered, onSelect, onHover, leafletZoom = 6 }) {
  const isTourist  = city.tourist === true
  const isT2       = city.tier === 2 && !isTourist
  const isIntl     = city.tier === 'international'
  const isCrossing = city.tier === 'crossing'

  const baseR = isIntl     ? INT_RADIUS
              : isCrossing ? CROSSING_RADIUS
              : isTourist  ? TOURIST_RADIUS
              : isT2       ? T2_RADIUS
              : city.isCapital ? T1_CAPITAL_RADIUS : T1_RADIUS

  const baseColor = isIntl     ? INT_COLOR
                  : isTourist  ? TOURIST_COLOR
                  : isT2       ? T2_COLOR
                  : city.isCapital ? T1_CAPITAL_COLOR : T1_COLOR

  const color = isSelected ? '#ffffff' : isHovered ? '#80ff80' : baseColor

  const showLabel = (!isT2 && !isIntl && !isTourist && !isCrossing) ||
                    (isT2      && leafletZoom >= T2_LABEL_ZOOM) ||
                    (isTourist && leafletZoom >= TOURIST_LABEL_ZOOM) ||
                    (isCrossing && leafletZoom >= CROSSING_LABEL_ZOOM) ||
                    isIntl

  // Font rośnie lekko ze zoomem Leaflet
  const zoomScale = Math.max(1, (leafletZoom - 5) * 0.5)
  const fontSize = isIntl || isTourist || isCrossing ? 7 * zoomScale
                 : isT2                              ? 8 * zoomScale
                 : city.isCapital                    ? 10 * zoomScale
                 :                                    9 * zoomScale

  const r = baseR
  const isT1 = !isT2 && !isIntl && !isTourist && !isCrossing
  const notSelectable = isIntl || isCrossing

  return (
    <g
      onClick={() => { if (!notSelectable) onSelect(city) }}
      onMouseEnter={() => onHover(city)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: notSelectable ? 'default' : 'pointer', pointerEvents: 'all' }}
    >
      {/* Pulsujący pierścień dla wybranego miasta */}
      {isSelected && !notSelectable && (
        <motion.circle
          cx={cx} cy={cy}
          r={r + 2}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.8}
          initial={{ r: r + 2, opacity: 1 }}
          animate={{ r: r + 10, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* Główny punkt */}
      {isCrossing ? (
        <>
          <circle cx={cx} cy={cy} r={r} fill="white" stroke="#888888" strokeWidth={0.8} />
          <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`} fill="#888888" />
        </>
      ) : (
        <circle
          cx={cx} cy={cy}
          r={(!isIntl && (isHovered || isSelected)) ? r * 1.4 : r}
          fill={isIntl ? 'none' : color}
          stroke={isSelected ? '#ffffff' : isIntl ? INT_COLOR : isT2 ? '#0a1a0a' : baseColor}
          strokeWidth={isIntl ? 1.2 : isT2 ? 0.4 : isTourist ? 0.6 : 1.0}
          style={{ transition: 'r 0.15s ease' }}
        />
      )}

      {/* Etykieta */}
      {showLabel && (
        <text
          x={cx + r + 2}
          y={cy + fontSize * 0.35}
          fill={isCrossing ? '#aaaaaa' : color}
          fontSize={fontSize}
          fontFamily="'Share Tech Mono', monospace"
          fontWeight={isSelected ? 'bold' : isT1 ? 'bold' : 'normal'}
          stroke={isT1 ? '#0a1a0a' : undefined}
          strokeWidth={isT1 ? fontSize * 0.28 : undefined}
          strokeLinejoin={isT1 ? 'round' : undefined}
          style={{
            paintOrder: isT1 ? 'stroke fill' : undefined,
            textDecoration: city.isCapital ? 'underline' : undefined,
            textDecorationColor: city.isCapital ? '#ff3333' : undefined,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {city.name}
        </text>
      )}
    </g>
  )
}
