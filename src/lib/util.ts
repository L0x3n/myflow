export const uid = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()

/** Lokalt datum YYYY-MM-DD (sv-SE-formatet är exakt så). */
export const todayStr = () => new Date().toLocaleDateString('sv-SE')
export const dateOnly = (iso: string) => new Date(iso).toLocaleDateString('sv-SE')

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

export function fmtDay(dateStr: string): string {
  const today = todayStr()
  if (dateStr === today) return 'idag'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateStr === tomorrow.toLocaleDateString('sv-SE')) return 'imorgon'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function headerDate(): string {
  const s = new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "om 25 min" / "om 2 tim" / "nu" — aldrig stressande exakthet. */
export function relTime(iso: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (diffMin <= 5 && diffMin >= -60) return 'nu'
  if (diffMin < 0) return ''
  if (diffMin < 60) return `om ${diffMin} min`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `om ${h} tim`
  return fmtDay(dateOnly(iso))
}

/** ISO-tidpunkt för HH:MM idag, lokal tid. */
export function todayAt(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
