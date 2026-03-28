export function timeToMins(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

export function minsToTime(m) {
    const normalized = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(normalized / 60).toString().padStart(2, '0');
    const min = (normalized % 60).toString().padStart(2, '0');
    return `${h}:${min}`;
}

export function isColliding(entryA, entryB, buffer) {
    const diff = Math.abs((entryA % 1440) - (entryB % 1440));
    const wrappedDiff = Math.min(diff, 1440 - diff);
    return wrappedDiff < buffer;
}
