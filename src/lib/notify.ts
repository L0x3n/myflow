import { fmtTime, todayAt, todayStr } from './util'
import type { Snapshot } from '../types'

// Notiser i MVP: körs medan appen är öppen (även i bakgrundsflik/installerad
// PWA så länge sidan lever). Äkta push när appen är stängd kräver backend-cron
// — se BACKLOG.md.

const FLAG_KEY = 'myflow-notify'
const SENT_KEY = 'myflow-notified'

export type NotifyStatus = 'unsupported' | 'off' | 'blocked' | 'on'

export function notifyStatus(): NotifyStatus {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission === 'granted' && localStorage.getItem(FLAG_KEY) === 'on') return 'on'
  return 'off'
}

export async function enableNotifications(): Promise<NotifyStatus> {
  if (typeof Notification === 'undefined') return 'unsupported'
  const p = await Notification.requestPermission()
  if (p === 'granted') {
    localStorage.setItem(FLAG_KEY, 'on')
    return 'on'
  }
  return p === 'denied' ? 'blocked' : 'off'
}

export function disableNotifications() {
  localStorage.setItem(FLAG_KEY, 'off')
}

function sentKeys(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function markSent(key: string) {
  const keys = [...sentKeys(), key].slice(-200)
  localStorage.setItem(SENT_KEY, JSON.stringify(keys))
}

async function show(title: string, body: string, tag: string) {
  const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, { body, tag, icon })
      return
    }
  } catch {
    /* faller tillbaka nedan */
  }
  try {
    new Notification(title, { body, tag, icon })
  } catch {
    /* notiser är inte kritiska — aldrig krascha appen för dem */
  }
}

/** Kollas var 30:e sekund från appen. Lugn, aldrig tjatig: en notis per sak. */
export function notifyTick(snap: Snapshot | null) {
  if (!snap || notifyStatus() !== 'on') return
  const now = Date.now()
  const today = todayStr()
  const sent = new Set(sentKeys())

  // Medicin: vid schemalagd tid (fönster 0–10 min efter, tills den bockats av).
  for (const med of snap.medications.filter((m) => m.active)) {
    for (const time of med.times) {
      const at = new Date(todayAt(time)).getTime()
      if (now < at || now > at + 10 * 60_000) continue
      const taken = snap.medLogs.some(
        (l) =>
          l.medication_id === med.id &&
          new Date(l.scheduled_at).toLocaleDateString('sv-SE') === today &&
          fmtTime(l.scheduled_at) === time &&
          l.taken_at,
      )
      if (taken) continue
      const key = `med-${med.id}-${time}-${today}`
      if (sent.has(key)) continue
      markSent(key)
      void show(`Dags för ${med.name}`, 'Bocka av i MyFlow när du tagit den. 💊', key)
    }
  }

  // Aktivitet: 30 min innan (fönster 25–31 min).
  for (const act of snap.activities) {
    const at = new Date(act.starts_at).getTime()
    const minutesUntil = (at - now) / 60_000
    if (minutesUntil < 25 || minutesUntil > 31) continue
    const key = `act-${act.id}`
    if (sent.has(key)) continue
    markSent(key)
    const where = act.location ? ` · ${act.location}` : ''
    void show(`${act.title} om 30 min`, `Kl ${fmtTime(act.starts_at)}${where}`, key)
  }
}
