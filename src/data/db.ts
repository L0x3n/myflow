import { supabase } from '../lib/supabase'
import { uid, nowIso, todayStr } from '../lib/util'
import type {
  Activity,
  ChatMessage,
  EnergyLevel,
  Errand,
  Medication,
  MedicationLog,
  Snapshot,
  Task,
} from '../types'

export interface NewTask {
  title: string
  errand_id?: string | null
  deadline?: string | null
  estimated_minutes?: number | null
  is_top3?: boolean
  top3_date?: string | null
}

export interface DB {
  mode: 'local' | 'cloud'
  setUser(id: string): void
  load(): Promise<Snapshot>
  createTask(input: NewTask): Promise<Task>
  updateTask(id: string, patch: Partial<Task>): Promise<void>
  deleteTask(id: string): Promise<void>
  createErrand(title: string, deadline: string | null, subtasks: string[]): Promise<{ errand: Errand; tasks: Task[] }>
  updateErrand(id: string, patch: Partial<Errand>): Promise<void>
  deleteErrand(id: string): Promise<void>
  setTop3(ids: string[], date: string): Promise<void>
  setFlowOrder(ids: string[]): Promise<void>
  saveMedication(input: { id?: string; name: string; times: string[] }): Promise<void>
  deleteMedication(id: string): Promise<void>
  addMedLog(medication_id: string, scheduled_at: string): Promise<void>
  removeMedLog(medication_id: string, scheduled_at: string): Promise<void>
  setEnergy(date: string, level: EnergyLevel): Promise<void>
  createActivity(title: string, starts_at: string, location: string | null): Promise<Activity>
  deleteActivity(id: string): Promise<void>
  addFriction(description: string, frequency: number, load: number): Promise<void>
  addChat(role: 'user' | 'assistant', content: string): Promise<ChatMessage>
}

// ---------------------------------------------------------------- lokalt läge

interface LocalData {
  tasks: Task[]
  errands: Errand[]
  medications: Medication[]
  medLogs: MedicationLog[]
  activities: Activity[]
  chat: ChatMessage[]
  energy: { date: string; level: EnergyLevel }[]
  frictions: { id: string; description: string; frequency: number; load: number; created_at: string }[]
}

const EMPTY: LocalData = {
  tasks: [],
  errands: [],
  medications: [],
  medLogs: [],
  activities: [],
  chat: [],
  energy: [],
  frictions: [],
}

const KEY = 'myflow-v1'

class LocalDB implements DB {
  mode = 'local' as const
  private d: LocalData

  constructor() {
    let d = EMPTY
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) d = { ...EMPTY, ...(JSON.parse(raw) as LocalData) }
    } catch {
      /* korrupt data → börja om hellre än att krascha */
    }
    this.d = d
  }

  private save() {
    localStorage.setItem(KEY, JSON.stringify(this.d))
  }

  setUser() {}

  async load(): Promise<Snapshot> {
    const t = todayStr()
    return {
      tasks: [...this.d.tasks],
      errands: [...this.d.errands],
      medications: [...this.d.medications],
      medLogs: [...this.d.medLogs],
      activities: [...this.d.activities],
      chat: this.d.chat.slice(-50),
      energyToday: this.d.energy.find((e) => e.date === t)?.level ?? null,
    }
  }

  async createTask(input: NewTask): Promise<Task> {
    const task: Task = {
      id: uid(),
      errand_id: input.errand_id ?? null,
      title: input.title,
      status: 'todo',
      deadline: input.deadline ?? null,
      estimated_minutes: input.estimated_minutes ?? null,
      is_top3: input.is_top3 ?? false,
      top3_date: input.top3_date ?? null,
      flow_order: null,
      created_at: nowIso(),
      completed_at: null,
    }
    this.d.tasks.push(task)
    this.save()
    return task
  }

  async updateTask(id: string, patch: Partial<Task>) {
    const t = this.d.tasks.find((x) => x.id === id)
    if (t) Object.assign(t, patch)
    this.save()
  }

  async deleteTask(id: string) {
    this.d.tasks = this.d.tasks.filter((x) => x.id !== id)
    this.save()
  }

  async createErrand(title: string, deadline: string | null, subtasks: string[]) {
    const errand: Errand = { id: uid(), title, status: 'active', deadline, created_at: nowIso() }
    this.d.errands.push(errand)
    const tasks: Task[] = []
    for (const st of subtasks) {
      tasks.push(await this.createTask({ title: st, errand_id: errand.id }))
    }
    this.save()
    return { errand, tasks }
  }

  async updateErrand(id: string, patch: Partial<Errand>) {
    const e = this.d.errands.find((x) => x.id === id)
    if (e) Object.assign(e, patch)
    this.save()
  }

  async deleteErrand(id: string) {
    this.d.errands = this.d.errands.filter((x) => x.id !== id)
    this.d.tasks = this.d.tasks.filter((x) => x.errand_id !== id)
    this.save()
  }

  async setTop3(ids: string[], date: string) {
    for (const t of this.d.tasks) {
      if (ids.includes(t.id)) {
        t.is_top3 = true
        t.top3_date = date
      } else if (t.is_top3) {
        t.is_top3 = false
        t.top3_date = null
      }
    }
    this.save()
  }

  async setFlowOrder(ids: string[]) {
    ids.forEach((id, i) => {
      const t = this.d.tasks.find((x) => x.id === id)
      if (t) t.flow_order = i
    })
    this.save()
  }

  async saveMedication(input: { id?: string; name: string; times: string[] }) {
    if (input.id) {
      const m = this.d.medications.find((x) => x.id === input.id)
      if (m) {
        m.name = input.name
        m.times = input.times
      }
    } else {
      this.d.medications.push({ id: uid(), name: input.name, times: input.times, active: true })
    }
    this.save()
  }

  async deleteMedication(id: string) {
    this.d.medications = this.d.medications.filter((x) => x.id !== id)
    this.d.medLogs = this.d.medLogs.filter((x) => x.medication_id !== id)
    this.save()
  }

  async addMedLog(medication_id: string, scheduled_at: string) {
    this.d.medLogs.push({ id: uid(), medication_id, scheduled_at, taken_at: nowIso() })
    this.save()
  }

  async removeMedLog(medication_id: string, scheduled_at: string) {
    this.d.medLogs = this.d.medLogs.filter(
      (x) => !(x.medication_id === medication_id && x.scheduled_at === scheduled_at),
    )
    this.save()
  }

  async setEnergy(date: string, level: EnergyLevel) {
    const e = this.d.energy.find((x) => x.date === date)
    if (e) e.level = level
    else this.d.energy.push({ date, level })
    this.save()
  }

  async createActivity(title: string, starts_at: string, location: string | null): Promise<Activity> {
    const a: Activity = { id: uid(), title, starts_at, location }
    this.d.activities.push(a)
    this.save()
    return a
  }

  async deleteActivity(id: string) {
    this.d.activities = this.d.activities.filter((x) => x.id !== id)
    this.save()
  }

  async addFriction(description: string, frequency: number, load: number) {
    this.d.frictions.push({ id: uid(), description, frequency, load, created_at: nowIso() })
    this.save()
  }

  async addChat(role: 'user' | 'assistant', content: string): Promise<ChatMessage> {
    const m: ChatMessage = { id: uid(), role, content, created_at: nowIso() }
    this.d.chat.push(m)
    this.save()
    return m
  }
}

// ----------------------------------------------------------------- molnläge

class CloudDB implements DB {
  mode = 'cloud' as const
  private userId = ''

  setUser(id: string) {
    this.userId = id
  }

  private get sb() {
    if (!supabase) throw new Error('Supabase saknas')
    return supabase
  }

  async load(): Promise<Snapshot> {
    const today = todayStr()
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const [tasks, errands, meds, logs, acts, chat, energy] = await Promise.all([
      this.sb.from('tasks').select('*').order('created_at'),
      this.sb.from('errands').select('*').order('created_at'),
      this.sb.from('medications').select('*').order('name'),
      this.sb.from('medication_logs').select('*').gte('scheduled_at', dayStart.toISOString()),
      this.sb.from('activities').select('*').order('starts_at'),
      this.sb.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(50),
      this.sb.from('energy_logs').select('*').eq('date', today).maybeSingle(),
    ])
    const err = tasks.error ?? errands.error ?? meds.error ?? logs.error ?? acts.error ?? chat.error ?? energy.error
    if (err) throw err
    return {
      tasks: (tasks.data ?? []) as Task[],
      errands: (errands.data ?? []) as Errand[],
      medications: (meds.data ?? []) as Medication[],
      medLogs: (logs.data ?? []) as MedicationLog[],
      activities: (acts.data ?? []) as Activity[],
      chat: ((chat.data ?? []) as ChatMessage[]).reverse(),
      energyToday: (energy.data?.level as EnergyLevel | undefined) ?? null,
    }
  }

  async createTask(input: NewTask): Promise<Task> {
    const { data, error } = await this.sb
      .from('tasks')
      .insert({
        user_id: this.userId,
        title: input.title,
        errand_id: input.errand_id ?? null,
        deadline: input.deadline ?? null,
        estimated_minutes: input.estimated_minutes ?? null,
        is_top3: input.is_top3 ?? false,
        top3_date: input.top3_date ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return data as Task
  }

  async updateTask(id: string, patch: Partial<Task>) {
    const { error } = await this.sb.from('tasks').update(patch).eq('id', id)
    if (error) throw error
  }

  async deleteTask(id: string) {
    const { error } = await this.sb.from('tasks').delete().eq('id', id)
    if (error) throw error
  }

  async createErrand(title: string, deadline: string | null, subtasks: string[]) {
    const { data, error } = await this.sb
      .from('errands')
      .insert({ user_id: this.userId, title, deadline })
      .select()
      .single()
    if (error) throw error
    const errand = data as Errand
    let tasks: Task[] = []
    if (subtasks.length) {
      const { data: td, error: te } = await this.sb
        .from('tasks')
        .insert(subtasks.map((t) => ({ user_id: this.userId, title: t, errand_id: errand.id })))
        .select()
      if (te) throw te
      tasks = (td ?? []) as Task[]
    }
    return { errand, tasks }
  }

  async updateErrand(id: string, patch: Partial<Errand>) {
    const { error } = await this.sb.from('errands').update(patch).eq('id', id)
    if (error) throw error
  }

  async deleteErrand(id: string) {
    const { error } = await this.sb.from('errands').delete().eq('id', id)
    if (error) throw error
  }

  async setTop3(ids: string[], date: string) {
    const { error: clearErr } = await this.sb
      .from('tasks')
      .update({ is_top3: false, top3_date: null })
      .eq('is_top3', true)
    if (clearErr) throw clearErr
    if (ids.length) {
      const { error } = await this.sb
        .from('tasks')
        .update({ is_top3: true, top3_date: date })
        .in('id', ids)
      if (error) throw error
    }
  }

  async setFlowOrder(ids: string[]) {
    for (let i = 0; i < ids.length; i++) {
      const { error } = await this.sb.from('tasks').update({ flow_order: i }).eq('id', ids[i])
      if (error) throw error
    }
  }

  async saveMedication(input: { id?: string; name: string; times: string[] }) {
    if (input.id) {
      const { error } = await this.sb
        .from('medications')
        .update({ name: input.name, times: input.times })
        .eq('id', input.id)
      if (error) throw error
    } else {
      const { error } = await this.sb
        .from('medications')
        .insert({ user_id: this.userId, name: input.name, times: input.times })
      if (error) throw error
    }
  }

  async deleteMedication(id: string) {
    const { error } = await this.sb.from('medications').delete().eq('id', id)
    if (error) throw error
  }

  async addMedLog(medication_id: string, scheduled_at: string) {
    const { error } = await this.sb
      .from('medication_logs')
      .insert({ user_id: this.userId, medication_id, scheduled_at, taken_at: nowIso() })
    if (error) throw error
  }

  async removeMedLog(medication_id: string, scheduled_at: string) {
    const { error } = await this.sb
      .from('medication_logs')
      .delete()
      .eq('medication_id', medication_id)
      .eq('scheduled_at', scheduled_at)
    if (error) throw error
  }

  async setEnergy(date: string, level: EnergyLevel) {
    const { error } = await this.sb
      .from('energy_logs')
      .upsert({ user_id: this.userId, date, level }, { onConflict: 'user_id,date' })
    if (error) throw error
  }

  async createActivity(title: string, starts_at: string, location: string | null): Promise<Activity> {
    const { data, error } = await this.sb
      .from('activities')
      .insert({ user_id: this.userId, title, starts_at, location })
      .select()
      .single()
    if (error) throw error
    return data as Activity
  }

  async deleteActivity(id: string) {
    const { error } = await this.sb.from('activities').delete().eq('id', id)
    if (error) throw error
  }

  async addFriction(description: string, frequency: number, load: number) {
    const { error } = await this.sb
      .from('frictions')
      .insert({ user_id: this.userId, description, frequency, load })
    if (error) throw error
  }

  async addChat(role: 'user' | 'assistant', content: string): Promise<ChatMessage> {
    const { data, error } = await this.sb
      .from('chat_messages')
      .insert({ user_id: this.userId, role, content })
      .select()
      .single()
    if (error) throw error
    return data as ChatMessage
  }
}

export const db: DB = supabase ? new CloudDB() : new LocalDB()
