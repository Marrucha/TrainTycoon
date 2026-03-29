export function calcAge(dob, referenceDate = new Date()) {
  if (!dob) return null
  const b = new Date(dob), now = referenceDate
  let a = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return a
}

export function calcTenure(hiredAt, referenceDate = new Date()) {
  if (!hiredAt) return '—'
  const months = Math.floor((Date.now() - new Date(hiredAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 1)  return '< 1 mies.'
  if (months < 12) return `${months} mies.`
  const y = Math.floor(months / 12), r = months % 12
  return r > 0 ? `${y} l. ${r} mies.` : `${y} l.`
}

export function retirementDate(dob) {
  if (!dob) return null
  const b = new Date(dob)
  return new Date(b.getFullYear() + 65, b.getMonth(), b.getDate())
}

export function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
