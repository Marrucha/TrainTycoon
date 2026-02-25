import { useState, useEffect } from 'react'

const COLOR_BY_TYPE = {
  EIC: '#ff8040',
  InterCity: '#f0c040',
  TLK: '#40a8f0',
}

export default function TrainDot({ from, to, travelTime, trainType, getPos }) {
  const [t, setT] = useState(0)
  const color = COLOR_BY_TYPE[trainType] || '#f0c040'

  useEffect(() => {
    // Czas jednego przejazdu w ms (min 4 s, skalowany z travelTime)
    const duration = Math.max(4000, (travelTime || 90) / 12 * 1000)
    let startTime = null
    let raf

    function animate(timestamp) {
      if (!startTime) startTime = timestamp
      const elapsed = (timestamp - startTime) % (duration * 2)
      // t: 0→1 (tam), 1→0 (z powrotem)
      const tVal = elapsed < duration ? elapsed / duration : 2 - elapsed / duration
      setT(tVal)
      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [travelTime])

  // Interpoluj lat/lon i przelicz na px
  const lat = from.lat + (to.lat - from.lat) * t
  const lon = from.lon + (to.lon - from.lon) * t
  const pos = getPos(lat, lon)

  return (
    <g>
      <circle cx={pos.x} cy={pos.y} r={6} fill={color} opacity={0.25} />
      <circle cx={pos.x} cy={pos.y} r={3} fill={color} stroke="#0a1a0a" strokeWidth={1} />
    </g>
  )
}
