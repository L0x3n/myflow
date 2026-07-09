import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { db } from './db'
import { askFlow } from '../flow/client'
import { nowIso, todayAt, todayStr, uid } from '../lib/util'
import type {
  Activity,
  EnergyLevel,
  ErrandStatus,
  FlowAction,
  Snapshot,
  Task,
} from '../types'

export interface PendingSuggestion {
  id: string
  action: FlowAction
  status: 'pending' | 'accepted' | 'rejected'
}

interface Store {
  snap: Snapshot | null
  loadError: boolean
  reload: () => Promise<void>

  addTask: (title: string, extras?: { errand_id?: string | null; makeTop3?: boolean }) => Promise<Task | null>
  toggleTaskDone: (id: string) => void
  deleteTask: (id: string) => void
  addErrand: (title: string, deadline: string | null, subtasks: string[]) => Promise<void>
  setErrandStatus: (id: string, status: ErrandStatus) => void
  deleteErrand: (id: string) => void
  setTop3: (ids: string[]) => Promise<void>
  setEnergy: (level: EnergyLevel) => void
  saveMedication: (input: { id?: string; name: string; times: string[] }) => Promise<void>
  deleteMedication: (id: string) => Promise<void>
  toggleMedTaken: (medicationId: string, time: string) => void
  addActivity: (title: string, startsAt: string, location: string | null) => Promise<void>
  deleteActivity: (id: string) => void
  addFriction: (description: string, frequency: number, load: number) => Promise<void>

  flowBusy: boolean
  suggestions: PendingSuggestion[]
  sendToFlow: (text: string) => Promise<void>
  acceptSuggestion: (id: string) => Promise<void>
  rejectSuggestion: (id: string) => void
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore utanför StoreProvider')
  return s
}

export function StoreProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [flowBusy, setFlowBusy] = useState(false)
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([])
  const snapRef = useRef<Snapshot | null>(null)
  snapRef.current = snap

  const reload = useCallback(async () => {
    try {
      setSnap(await db.load())
      setLoadError(false)
    } catch (e) {
      console.error('load failed', e)
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    if (userId) db.setUser(userId)
    void reload()
  }, [userId, reload])

  const patch = useCallback((fn: (s: Snapshot) => Snapshot) => {
    setSnap((s) => (s ? fn(s) : s))
  }, [])

  /** Optimistisk mutation: uppdatera UI direkt, synka i bakgrunden, ladda om vid fel. */
  const mutate = useCallback(
    (apply: (s: Snapshot) => Snapshot, op: () => Promise<unknown>) => {
      patch(apply)
      op().catch((e) => {
        console.error('sync failed', e)
        void reload()
      })
    },
    [patch, reload],
  )

  const addTask = useCallback(
    async (title: string, extras?: { errand_id?: string | null; makeTop3?: boolean }) => {
      try {
        const today = todayStr()
        const task = await db.createTask({
          title,
          errand_id: extras?.errand_id ?? null,
          is_top3: extras?.makeTop3 ?? false,
          top3_date: extras?.makeTop3 ? today : null,
        })
        patch((s) => ({ ...s, tasks: [...s.tasks, task] }))
        return task
      } catch (e) {
        console.error(e)
        void reload()
        return null
      }
    },
    [patch, reload],
  )

  const toggleTaskDone = useCallback(
    (id: string) => {
      const t = snapRef.current?.tasks.find((x) => x.id === id)
      if (!t) return
      const done = t.status !== 'done'
      const p: Partial<Task> = { status: done ? 'done' : 'todo', completed_at: done ? nowIso() : null }
      mutate(
        (s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...p } : x)) }),
        () => db.updateTask(id, p),
      )
    },
    [mutate],
  )

  const deleteTask = useCallback(
    (id: string) => {
      mutate(
        (s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== id) }),
        () => db.deleteTask(id),
      )
    },
    [mutate],
  )

  const addErrand = useCallback(
    async (title: string, deadline: string | null, subtasks: string[]) => {
      try {
        const { errand, tasks } = await db.createErrand(title, deadline, subtasks)
        patch((s) => ({ ...s, errands: [...s.errands, errand], tasks: [...s.tasks, ...tasks] }))
      } catch (e) {
        console.error(e)
        void reload()
      }
    },
    [patch, reload],
  )

  const setErrandStatus = useCallback(
    (id: string, status: ErrandStatus) => {
      mutate(
        (s) => ({ ...s, errands: s.errands.map((x) => (x.id === id ? { ...x, status } : x)) }),
        () => db.updateErrand(id, { status }),
      )
    },
    [mutate],
  )

  const deleteErrand = useCallback(
    (id: string) => {
      mutate(
        (s) => ({
          ...s,
          errands: s.errands.filter((x) => x.id !== id),
          tasks: s.tasks.filter((x) => x.errand_id !== id),
        }),
        () => db.deleteErrand(id),
      )
    },
    [mutate],
  )

  const setTop3 = useCallback(
    async (ids: string[]) => {
      const today = todayStr()
      mutate(
        (s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            ids.includes(t.id)
              ? { ...t, is_top3: true, top3_date: today }
              : t.is_top3
                ? { ...t, is_top3: false, top3_date: null }
                : t,
          ),
        }),
        () => db.setTop3(ids, today),
      )
    },
    [mutate],
  )

  const setEnergy = useCallback(
    (level: EnergyLevel) => {
      mutate(
        (s) => ({ ...s, energyToday: level }),
        () => db.setEnergy(todayStr(), level),
      )
    },
    [mutate],
  )

  const saveMedication = useCallback(
    async (input: { id?: string; name: string; times: string[] }) => {
      await db.saveMedication(input).catch(console.error)
      await reload()
    },
    [reload],
  )

  const deleteMedication = useCallback(
    async (id: string) => {
      await db.deleteMedication(id).catch(console.error)
      await reload()
    },
    [reload],
  )

  const toggleMedTaken = useCallback(
    (medicationId: string, time: string) => {
      const scheduledAt = todayAt(time)
      const existing = snapRef.current?.medLogs.find(
        (l) => l.medication_id === medicationId && l.scheduled_at === scheduledAt && l.taken_at,
      )
      if (existing) {
        mutate(
          (s) => ({ ...s, medLogs: s.medLogs.filter((l) => l.id !== existing.id) }),
          () => db.removeMedLog(medicationId, scheduledAt),
        )
      } else {
        const optimistic = { id: uid(), medication_id: medicationId, scheduled_at: scheduledAt, taken_at: nowIso() }
        mutate(
          (s) => ({ ...s, medLogs: [...s.medLogs, optimistic] }),
          () => db.addMedLog(medicationId, scheduledAt),
        )
      }
    },
    [mutate],
  )

  const addActivity = useCallback(
    async (title: string, startsAt: string, location: string | null) => {
      try {
        const a = await db.createActivity(title, startsAt, location)
        patch((s) => ({
          ...s,
          activities: [...s.activities, a].sort((x, y) => x.starts_at.localeCompare(y.starts_at)),
        }))
      } catch (e) {
        console.error(e)
        void reload()
      }
    },
    [patch, reload],
  )

  const deleteActivity = useCallback(
    (id: string) => {
      mutate(
        (s) => ({ ...s, activities: s.activities.filter((x) => x.id !== id) }),
        () => db.deleteActivity(id),
      )
    },
    [mutate],
  )

  const addFriction = useCallback(async (description: string, frequency: number, load: number) => {
    await db.addFriction(description, frequency, load).catch(console.error)
  }, [])

  const sendToFlow = useCallback(
    async (text: string) => {
      const s = snapRef.current
      if (!s || flowBusy) return
      setFlowBusy(true)
      try {
        const history = s.chat.slice(-20).map((m) => ({ role: m.role, content: m.content }))
        const userMsg = await db.addChat('user', text)
        patch((x) => ({ ...x, chat: [...x.chat, userMsg] }))
        const res = await askFlow(text, history)
        const aMsg = await db.addChat('assistant', res.reply)
        patch((x) => ({ ...x, chat: [...x.chat, aMsg] }))
        setSuggestions(res.actions.map((action) => ({ id: uid(), action, status: 'pending' as const })))
      } catch (e) {
        console.error('flow failed', e)
        const aMsg = await db
          .addChat('assistant', 'Jag nådde inte fram just nu. Det är lugnt — prova igen om en stund.')
          .catch(() => null)
        if (aMsg) patch((x) => ({ ...x, chat: [...x.chat, aMsg] }))
      } finally {
        setFlowBusy(false)
      }
    },
    [flowBusy, patch],
  )

  const acceptSuggestion = useCallback(
    async (id: string) => {
      const sug = suggestions.find((x) => x.id === id)
      const s = snapRef.current
      if (!sug || !s) return
      const a = sug.action
      try {
        if (a.type === 'create_task') {
          await addTask(a.title)
        } else if (a.type === 'create_errand') {
          await addErrand(a.title, null, a.subtasks)
        } else if (a.type === 'set_top3') {
          const valid = a.task_ids.filter((tid) => s.tasks.some((t) => t.id === tid))
          if (valid.length) await setTop3(valid.slice(0, 3))
        } else if (a.type === 'set_flow_order') {
          const valid = a.ordered_task_ids.filter((tid) => s.tasks.some((t) => t.id === tid))
          await db.setFlowOrder(valid)
          patch((x) => ({
            ...x,
            tasks: x.tasks.map((t) => {
              const i = valid.indexOf(t.id)
              return i >= 0 ? { ...t, flow_order: i } : t
            }),
          }))
        }
        setSuggestions((list) => list.map((x) => (x.id === id ? { ...x, status: 'accepted' } : x)))
      } catch (e) {
        console.error(e)
      }
    },
    [suggestions, addTask, addErrand, setTop3, patch],
  )

  const rejectSuggestion = useCallback((id: string) => {
    setSuggestions((list) => list.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)))
  }, [])

  const value = useMemo<Store>(
    () => ({
      snap,
      loadError,
      reload,
      addTask,
      toggleTaskDone,
      deleteTask,
      addErrand,
      setErrandStatus,
      deleteErrand,
      setTop3,
      setEnergy,
      saveMedication,
      deleteMedication,
      toggleMedTaken,
      addActivity,
      deleteActivity,
      addFriction,
      flowBusy,
      suggestions,
      sendToFlow,
      acceptSuggestion,
      rejectSuggestion,
    }),
    [
      snap, loadError, reload, addTask, toggleTaskDone, deleteTask, addErrand, setErrandStatus,
      deleteErrand, setTop3, setEnergy, saveMedication, deleteMedication, toggleMedTaken,
      addActivity, deleteActivity, addFriction, flowBusy, suggestions, sendToFlow,
      acceptSuggestion, rejectSuggestion,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// ------------------------------------------------------------------ selektorer

export const byFlowOrder = (a: Task, b: Task) =>
  (a.flow_order ?? 1e9) - (b.flow_order ?? 1e9) || a.created_at.localeCompare(b.created_at)

export function top3Today(s: Snapshot): Task[] {
  const t = todayStr()
  return s.tasks.filter((x) => x.is_top3 && x.top3_date === t).sort(byFlowOrder)
}

export function openTodos(s: Snapshot): Task[] {
  return s.tasks.filter((x) => x.status !== 'done').sort(byFlowOrder)
}

export function rolledOverFromYesterday(s: Snapshot): boolean {
  const t = todayStr()
  return s.tasks.some((x) => x.is_top3 && x.top3_date !== null && x.top3_date < t && x.status !== 'done')
}

export function nextActivity(s: Snapshot): Activity | null {
  const now = new Date(Date.now() - 30 * 60000).toISOString() // pågående (30 min in) räknas
  return s.activities.filter((a) => a.starts_at >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
}

export function subtasksOf(s: Snapshot, errandId: string): Task[] {
  return s.tasks.filter((t) => t.errand_id === errandId).sort((a, b) => a.created_at.localeCompare(b.created_at))
}
