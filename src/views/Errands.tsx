import { useState } from 'react'
import { subtasksOf, useStore } from '../data/store'
import { fmtDay } from '../lib/util'
import { TaskRow } from './Today'
import type { Errand, ErrandStatus } from '../types'

const STATUS_META: Record<ErrandStatus, { label: string; cls: string; next: ErrandStatus }> = {
  active: { label: 'Pågår', cls: 'bg-sage-mist text-sage-deep', next: 'waiting' },
  waiting: { label: 'Väntar på', cls: 'bg-amber-mist text-amber', next: 'done' },
  done: { label: 'Klart', cls: 'bg-cream text-faint', next: 'active' },
}

export default function Errands() {
  const store = useStore()
  const { snap } = store
  const [text, setText] = useState('')
  const [creating, setCreating] = useState(false)

  if (!snap) return <p className="px-5 pt-12 text-soft">Laddar…</p>

  const standalone = snap.tasks.filter((t) => t.errand_id === null)
  const open = standalone.filter((t) => t.status !== 'done')
  const doneToday = standalone.filter(
    (t) => t.status === 'done' && t.completed_at && new Date(t.completed_at).toLocaleDateString('sv-SE') === new Date().toLocaleDateString('sv-SE'),
  )
  const errands = [...snap.errands].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))

  const quickAdd = async () => {
    const title = text.trim()
    if (!title) return
    setText('')
    await store.addTask(title)
  }

  return (
    <div className="px-5 pt-8 space-y-5 fade-up">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ärenden</h1>
        <p className="text-sm text-soft">Allt som ska göras — utan press.</p>
      </header>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
          placeholder="Lägg till uppgift…"
          className="flex-1 rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-sage"
        />
        <button onClick={quickAdd} className="rounded-xl bg-sage px-4 text-white" aria-label="Lägg till">
          +
        </button>
      </div>

      {(open.length > 0 || doneToday.length > 0) && (
        <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
          <h2 className="font-medium">Uppgifter</h2>
          <div className="mt-1 divide-y divide-line">
            {open.map((t) => (
              <div key={t.id} className="group flex items-center">
                <div className="flex-1">
                  <TaskRow task={t} onToggle={store.toggleTaskDone} />
                </div>
                <button
                  onClick={() => store.deleteTask(t.id)}
                  className="px-2 text-faint"
                  aria-label={`Ta bort ${t.title}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {doneToday.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={store.toggleTaskDone} />
            ))}
          </div>
        </section>
      )}

      <button
        onClick={() => setCreating((v) => !v)}
        className="w-full rounded-2xl border border-dashed border-sage/60 bg-sage-mist/50 py-3.5 text-sage-deep"
      >
        {creating ? 'Stäng' : '+ Nytt ärende (något större, med delsteg)'}
      </button>

      {creating && <NewErrandForm onDone={() => setCreating(false)} />}

      {errands.map((e) => (
        <ErrandCard key={e.id} errand={e} />
      ))}

      {errands.length === 0 && !creating && (
        <p className="px-1 text-sm text-soft">
          Ärenden är större saker med flera steg — som "Fixa körkortstillstånd". Skapa ett här, eller be Flow bryta
          ner något åt dig.
        </p>
      )}
    </div>
  )
}

function NewErrandForm({ onDone }: { onDone: () => void }) {
  const store = useStore()
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [steps, setSteps] = useState('')

  const save = async () => {
    if (!title.trim()) return
    const subtasks = steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    await store.addErrand(title.trim(), deadline || null, subtasks)
    onDone()
  }

  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm border border-line space-y-2 fade-up">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Vad gäller det?"
        className="w-full rounded-xl border border-line bg-cream px-4 py-3 outline-none focus:border-sage"
      />
      <textarea
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
        placeholder={'Delsteg, ett per rad (valfritt)\nt.ex.\nBeställ blanketten\nFyll i den\nSkicka in'}
        rows={4}
        className="w-full resize-none rounded-xl border border-line bg-cream px-4 py-3 outline-none focus:border-sage"
      />
      <label className="block text-sm text-soft">
        Deadline (valfritt)
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-cream px-4 py-3 outline-none focus:border-sage"
        />
      </label>
      <button onClick={save} className="w-full rounded-xl bg-sage py-3 text-white">
        Skapa ärende
      </button>
    </div>
  )
}

function ErrandCard({ errand }: { errand: Errand }) {
  const store = useStore()
  const snap = store.snap!
  const [expanded, setExpanded] = useState(errand.status !== 'done')
  const [newStep, setNewStep] = useState('')
  const subs = subtasksOf(snap, errand.id)
  const doneCount = subs.filter((t) => t.status === 'done').length
  const meta = STATUS_META[errand.status]

  const addStep = async () => {
    const t = newStep.trim()
    if (!t) return
    setNewStep('')
    await store.addTask(t, { errand_id: errand.id })
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 text-left">
        <span className="flex-1 font-medium">{errand.title}</span>
        <span
          onClick={(e) => {
            e.stopPropagation()
            store.setErrandStatus(errand.id, meta.next)
          }}
          className={`rounded-full px-3 py-1 text-xs ${meta.cls}`}
        >
          {meta.label}
        </span>
      </button>
      <p className="mt-1 text-xs text-faint">
        {subs.length > 0 && `${doneCount} av ${subs.length} steg`}
        {errand.deadline && ` · ${fmtDay(errand.deadline)}`}
      </p>

      {expanded && (
        <div className="mt-2 fade-up">
          <div className="divide-y divide-line">
            {subs.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={store.toggleTaskDone} />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStep()}
              placeholder="Nytt delsteg…"
              className="flex-1 rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-sage"
            />
            <button onClick={addStep} className="rounded-xl bg-sage-mist px-3 text-sage-deep">
              +
            </button>
          </div>
          <button
            onClick={() => {
              if (window.confirm(`Ta bort "${errand.title}" och alla delsteg?`)) store.deleteErrand(errand.id)
            }}
            className="mt-3 text-xs text-faint underline-offset-2 hover:underline"
          >
            Ta bort ärendet
          </button>
        </div>
      )}
    </section>
  )
}
