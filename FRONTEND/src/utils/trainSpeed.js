/**
 * Train speed utilities.
 *
 * Formula:
 *   compositionSpeed = min(locoMaxSpeed - wagonCount * 2, minComponentSpeed)
 *   segmentEffectiveSpeed = min(compositionSpeed, trackSpeed)
 *   actualTravelTime = ceil(distance / segmentEffectiveSpeed * 60)
 *
 * trackSpeed per segment = edge.distance / edge.travelTime * 60
 * Note: the pomocnik (assistant driver) modifier is NOT applied here —
 * it only affects operational speed, not schedule building.
 */

/**
 * Returns the composition-based effective speed (no track limit applied).
 * @param {number} locoMaxSpeed  - max speed of the fastest component (km/h)
 * @param {number} wagonCount    - total number of components in the set
 * @param {number} minComponentSpeed - min speed across all components (km/h)
 */
export function calcCompositionSpeed(locoMaxSpeed, wagonCount, minComponentSpeed) {
  return Math.max(1, Math.min(
    locoMaxSpeed - wagonCount * 2,
    minComponentSpeed
  ))
}

/**
 * Returns actual travel time (minutes) for one route edge given a composition speed.
 * If the train is slower than the track allows → uses train speed.
 * If faster → capped by track (returns edge.travelTime).
 */
export function calcEdgeTravelTime(compositionSpeed, edgeDistance, edgeTravelTime) {
  if (!edgeDistance || !edgeTravelTime) return edgeTravelTime ?? 60
  const trackSpeed = (edgeDistance / edgeTravelTime) * 60
  const effective = Math.min(compositionSpeed, trackSpeed)
  return Math.ceil(edgeDistance / effective * 60)
}

/**
 * Computes the max total extra delay (minutes) over a set of route edges
 * when composition speed drops from scheduledSpeed to newSpeed.
 */
export function calcTotalDelay(edges, scheduledSpeed, newSpeed) {
  let total = 0
  for (const edge of edges) {
    if (!edge.distance || !edge.travelTime) continue
    const trackSpeed = (edge.distance / edge.travelTime) * 60
    const oldEff = Math.min(scheduledSpeed, trackSpeed)
    const newEff = Math.min(newSpeed, trackSpeed)
    if (newEff < oldEff) {
      total += Math.ceil(edge.distance / newEff * 60) - Math.ceil(edge.distance / oldEff * 60)
    }
  }
  return total
}
