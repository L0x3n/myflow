export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done'

export interface Task {
  id: string
  errand_id: string | null
  title: string
  status: TaskStatus
  deadline: string | null
  estimated_minutes: number | null
  is_top3: boolean
  top3_date: string | null
  flow_order: number | null
  created_at: string
  completed_at: string | null
}

export type ErrandStatus = 'active' | 'waiting' | 'done'

export interface Errand {
  id: string
  title: string
  status: ErrandStatus
  deadline: string | null
  created_at: string
}

export interface Medication {
  id: string
  name: string
  times: string[]
  active: boolean
}

export interface MedicationLog {
  id: string
  medication_id: string
  scheduled_at: string
  taken_at: string | null
}

export interface Activity {
  id: string
  title: string
  starts_at: string
  location: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type EnergyLevel = 1 | 2 | 3

export type FlowAction =
  | { type: 'create_task'; title: string; deadline?: string | null; estimated_minutes?: number | null }
  | { type: 'create_errand'; title: string; subtasks: string[] }
  | { type: 'set_top3'; task_ids: string[] }
  | { type: 'set_flow_order'; ordered_task_ids: string[] }

export interface FlowResult {
  reply: string
  actions: FlowAction[]
}

export interface Snapshot {
  tasks: Task[]
  errands: Errand[]
  medications: Medication[]
  medLogs: MedicationLog[]
  activities: Activity[]
  chat: ChatMessage[]
  energyToday: EnergyLevel | null
}
