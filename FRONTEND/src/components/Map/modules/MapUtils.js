export const timeToMin = (t) => {
    if (!t) return -1
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}

export const getBezierCP = (x1, y1, x2, y2, id) => {
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return { cpx: mx, cpy: my }
    const offset = Math.min(dist * 0.12, 35)
    const sign = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 0 ? 1 : -1
    const cpx = mx + (-dy / dist) * offset * sign
    const cpy = my + (dx / dist) * offset * sign
    return { cpx, cpy }
}

export const quadBezierPoint = (x1, y1, cpx, cpy, x2, y2, t) => {
    const x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cpx + t ** 2 * x2
    const y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cpy + t ** 2 * y2
    return { x, y }
}

export const quadBezierAngle = (x1, y1, cpx, cpy, x2, y2, t) => {
    const dx = 2 * (1 - t) * (cpx - x1) + 2 * t * (x2 - cpx)
    const dy = 2 * (1 - t) * (cpy - y1) + 2 * t * (y2 - cpy)
    return Math.atan2(dy, dx) * 180 / Math.PI
}

export const getCurvedPath = (x1, y1, x2, y2, id) => {
    const { cpx, cpy } = getBezierCP(x1, y1, x2, y2, id)
    return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`
}
