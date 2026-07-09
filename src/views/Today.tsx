import { useEffect, useMemo, useState } from 'react'
import {
  nextActivity,
  openTodos,
  rolledOverFromYesterday,
  subtasksOf,
  top3Today,
  useStore,
} from '../data/store'
import { fetchWeather, getPlace, type Weather } from '../lib/weather'
import { fmtDay, fmtTime, headerDate, relTime, todayAt, todayStr } from '../lib/util'
import type { EnergyLevel, Snapshot, Task } from '../types'

const ENERGY_META: Record<EnergyLevel, { label: string; emoji: string }> = {
  1: { label: 'Låg', emoji: '🌙' },
  2: { label: 'Okej', emoji: '🌤️' },
  3: { label: 'Bra', emoji: '☀️' },
}

export default function Today({ onHelp }: { onHelp: () => void }) {
  const store = useStore()
  const { snap } = store
  const [askEnergy, setAskEnergy] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    fetchWeather(getPlace())
      .then(setWeather)
      .catch(() => setWeather(null))
  }, [])

  if (!snap) return <Loading />

  const energy = snap.energyToday
  const top3 = top3Today(snap)
  const todos = openTodos(snap)
  const rolled = rolledOverFromYesterday(snap)
  const needEnergy = energy === null || askEnergy

  return (
    <div className="px-5 pt-8 space-y-5 fade-up">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-soft">{headerDate()}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Idag</h1>
        </div>
        {energy !== null && !askEnergy && (
          <button
            onClick={() => setAskEnergy(true)}
            className="rounded-full bg-sage-mist px-3 py-1.5 text-sm text-sage-deep"
          >
            {ENERGY_META[energy].emoji} {ENERGY_META[energy].label}
          </button>
        )}
      </header>

      {needEnergy ? (
        <EnergyCard
          current={energy}
          onPick={(l) => {
            store.setEnergy(l)
            setAskEnergy(false)
          }}
        />
      ) : energy === 1 ? (
        <LowEnergyDay snap={snap} onHelp={onHelp} />
      ) : (
        <>
          {rolled && top3.length === 0 && (
            <p className="text-sm text-soft px-1">Det blev mycket igår — det är okej. Idag är en ny dag.</p>
          )}

          <Top3Section
            top3={top3}
            onPick={() => setShowPicker(true)}
            onToggle={store.toggleTaskDone}
          />

          <MedSection />
          <NextActivitySection />

          {energy === 3 && (
            <>
              {weather && <WeatherCard w={weather} />}
              <BiggerThing snap={snap} />
            </>
          )}

          {todos.length > 0 && (
            <button
              onClick={onHelp}
              className="w-full rounded-2xl bg-sage py-4 text-lg font-medium text-white shadow-sm active:bg-sage-deep"
            >
              Hjälp mig — en sak i taget
            </button>
          )}
        </>
      )}

      {showPicker && <Top3Picker onClose={() => setShowPicker(false)} />}
    </div>
  )
}

function Loading() {
  return <p className="px-5 pt-12 text-soft">Laddar…</p>
}

// ------------------------------------------------------------------- energi

function EnergyCard({ current, onPick }: { current: EnergyLevel | null; onPick: (l: EnergyLevel) => void }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm border border-line fade-up">
      <p className="text-lg font-medium">Hur mycket energi har du idag?</p>
      <p className="mt-1 text-sm text-soft">Alla svar är rätt svar.</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {([1, 2, 3] as EnergyLevel[]).map((l) => (
          <button
            key={l}
            onClick={() => onPick(l)}
            className={`rounded-xl border py-4 text-center transition-colors ${
              current === l ? 'border-sage bg-sage-mist' : 'border-line bg-cream'
            }`}
          >
            <div className="text-2xl">{ENERGY_META[l].emoji}</div>
            <div className="mt-1 text-sm">{ENERGY_META[l].label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- låg energi-dag

function LowEnergyDay({ snap, onHelp }: { snap: Snapshot; onHelp: () => void }) {
  const store = useStore()
  const top3 = top3Today(snap)
  const one = top3.find((t) => t.status !== 'done') ?? openTodos(snap)[0] ?? null
  return (
    <div className="space-y-5">
      <p className="text-soft px-1">Låg energi idag. Då gör vi det enkelt — en enda sak räcker.</p>
      {one ? (
        <div className="rounded-2xl bg-card p-5 shadow-sm border border-line">
          <p className="text-xs uppercase tracking-wide text-faint">Bara det här</p>
          <TaskRow task={one} big onToggle={store.toggleTaskDone} />
        </div>
      ) : (
        <div className="rounded-2xl bg-sage-mist p-5 text-sage-deep">
          Inget som väntar. Vila är också något. 🌿
        </div>
      )}
      <MedSection />
      {one && (
        <button
          onClick={onHelp}
          className="w-full rounded-2xl bg-sage py-4 text-lg font-medium text-white shadow-sm active:bg-sage-deep"
        >
          Hjälp mig komma igång
        </button>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ dagens tre

function Top3Section({
  top3,
  onPick,
  onToggle,
}: {
  top3: Task[]
  onPick: () => void
  onToggle: (id: string) => void
}) {
  const allDone = top3.length > 0 && top3.every((t) => t.status === 'done')
  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Dagens tre</h2>
        {top3.length > 0 && (
          <button onClick={onPick} className="text-sm text-sage-deep">
            Ändra
          </button>
        )}
      </div>
      {top3.length === 0 ? (
        <button
          onClick={onPick}
          className="mt-3 w-full rounded-xl border border-dashed border-sage/60 bg-sage-mist/50 py-4 text-sage-deep"
        >
          Välj dagens tre
        </button>
      ) : (
        <div className="mt-2 divide-y divide-line">
          {top3.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={onToggle} />
          ))}
        </div>
      )}
      {allDone && <p className="mt-3 text-sm text-sage-deep">Alla tre klara. Riktigt fint. 🌿</p>}
    </section>
  )
}

export function TaskRow({
  task,
  onToggle,
  big,
}: {
  task: Task
  onToggle: (id: string) => void
  big?: boolean
}) {
  const done = task.status === 'done'
  const deadlineToday = task.deadline === todayStr() && !done
  return (
    <button onClick={() => onToggle(task.id)} className="flex w-full items-center gap-3 py-3 text-left">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          done ? 'border-sage bg-sage text-white' : 'border-faint'
        }`}
      >
        {done && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-current stroke-2">
            <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={`flex-1 ${big ? 'text-xl font-medium' : ''} ${done ? 'text-faint line-through decoration-1' : ''}`}>
        {task.title}
      </span>
      {task.estimated_minutes && !done && (
        <span className="text-xs text-faint">{task.estimated_minutes} min</span>
      )}
      {task.deadline && !done && (
        <span className={`text-xs ${deadlineToday ? 'font-medium text-terra' : 'text-faint'}`}>
          {fmtDay(task.deadline)}
        </span>
      )}
    </button>
  )
}

function Top3Picker({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const snap = store.snap!
  const today = todayStr()
  const initial = useMemo(
    () => top3Today(snap).map((t) => t.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [sel, setSel] = useState<string[]>(initial)
  const [text, setText] = useState('')

  // Ogjorda uppgifter; gårdagens top3 först — de förtjänar en mjuk andra chans.
  const candidates = openTodos(snap).sort((a, b) => {
    const av = a.top3_date && a.top3_date < today ? 0 : 1
    const bv = b.top3_date && b.top3_date < today ? 0 : 1
    return av - bv
  })

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 3 ? [...s, id] : s))

  const quickAdd = async () => {
    const title = text.trim()
    if (!title) return
    setText('')
    const t = await store.addTask(title)
    if (t) setSel((s) => (s.length < 3 ? [...s, t.id] : s))
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream p-5 pb-8 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Vilka tre känns viktigast idag?</h2>
        <p className="mt-1 text-sm text-soft">Färre går också bra.</p>

        <div className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
            placeholder="Lägg till ny uppgift…"
            className="flex-1 rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-sage"
          />
          <button onClick={quickAdd} className="rounded-xl bg-sage px-4 text-white">
            +
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {candidates.length === 0 && <p className="text-sm text-soft">Inga uppgifter än — lägg till en ovanför.</p>}
          {candidates.map((t) => {
            const on = sel.includes(t.id)
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  on ? 'border-sage bg-sage-mist' : 'border-line bg-card'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                    on ? 'border-sage bg-sage text-white' : 'border-faint text-transparent'
                  }`}
                >
                  {on ? sel.indexOf(t.id) + 1 : ''}
                </span>
                <span className="flex-1">{t.title}</span>
                {t.deadline && <span className="text-xs text-faint">{fmtDay(t.deadline)}</span>}
              </button>
            )
          })}
        </div>

        <button
          onClick={async () => {
            await store.setTop3(sel)
            onClose()
          }}
          className="mt-5 w-full rounded-2xl bg-sage py-4 font-medium text-white active:bg-sage-deep"
        >
          Klart
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------- medicin

export function MedSection() {
  const store = useStore()
  const snap = store.snap!
  const meds = snap.medications.filter((m) => m.active)
  if (meds.length === 0) return null
  const today = todayStr()
  const now = Date.now()

  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <h2 className="font-medium">Medicin</h2>
      <div className="mt-1 divide-y divide-line">
        {meds.flatMap((m) =>
          m.times.map((time) => {
            const scheduledAt = todayAt(time)
            const taken = snap.medLogs.some(
              (l) =>
                l.medication_id === m.id &&
                new Date(l.scheduled_at).toLocaleDateString('sv-SE') === today &&
                fmtTime(l.scheduled_at) === time &&
                l.taken_at,
            )
            const due = !taken && now >= new Date(scheduledAt).getTime()
            return (
              <button
                key={m.id + time}
                onClick={() => store.toggleMedTaken(m.id, time)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    taken ? 'border-sage bg-sage text-white' : due ? 'border-amber bg-amber-mist' : 'border-faint'
                  }`}
                >
                  {taken && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-current stroke-2">
                      <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className={taken ? 'text-faint' : ''}>{m.name}</span>
                <span className={`ml-auto text-sm ${due ? 'text-amber' : 'text-faint'}`}>{time}</span>
              </button>
            )
          }),
        )}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------- aktivitet

function NextActivitySection() {
  const store = useStore()
  const snap = store.snap!
  const next = nextActivity(snap)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [loc, setLoc] = useState('')

  const save = async () => {
    if (!title.trim() || !when) return
    await store.addActivity(title.trim(), new Date(when).toISOString(), loc.trim() || null)
    setAdding(false)
    setTitle('')
    setWhen('')
    setLoc('')
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Nästa aktivitet</h2>
        <button onClick={() => setAdding((v) => !v)} className="text-sm text-sage-deep">
          {adding ? 'Stäng' : '+ Lägg till'}
        </button>
      </div>

      {next ? (
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-lg font-semibold">{fmtTime(next.starts_at)}</span>
          <span className="flex-1">
            {next.title}
            {next.location && <span className="text-soft"> · {next.location}</span>}
          </span>
          <span className="text-sm text-sage-deep">{relTime(next.starts_at)}</span>
        </div>
      ) : (
        !adding && <p className="mt-2 text-sm text-soft">Inget inbokat. Skönt, eller lägg till något.</p>
      )}

      {adding && (
        <div className="mt-3 space-y-2 fade-up">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Vad?"
            className="w-full rounded-xl border border-line bg-cream px-4 py-3 outline-none focus:border-sage"
          />
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-3 outline-none focus:border-sage"
          />
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="Var? (valfritt)"
            className="w-full rounded-xl border border-line bg-cream px-4 py-3 outline-none focus:border-sage"
          />
          <button onClick={save} className="w-full rounded-xl bg-sage py-3 text-white">
            Spara
          </button>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------- väder

function WeatherCard({ w }: { w: Weather }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <div className="flex items-center gap-4">
        <span className="text-3xl">{w.emoji}</span>
        <div className="flex-1">
          <p className="font-medium">
            {w.temp}° · {w.label}
          </p>
          <p className="text-sm text-soft">
            {w.tempMin}° till {w.tempMax}°{w.rainProb >= 20 ? ` · ${w.rainProb}% regn` : ''}
          </p>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-sage-mist px-4 py-2.5 text-sm text-sage-deep">💭 {w.advice}</p>
    </section>
  )
}

// ------------------------------------------------------------- "om du orkar"

function BiggerThing({ snap }: { snap: Snapshot }) {
  const errand = snap.errands.find(
    (e) => e.status === 'active' && subtasksOf(snap, e.id).some((t) => t.status !== 'done'),
  )
  if (!errand) return null
  const nextStep = subtasksOf(snap, errand.id).find((t) => t.status !== 'done')
  return (
    <section className="rounded-2xl border border-sage/40 bg-sage-mist p-5">
      <p className="text-sm text-sage-deep">
        Bra energi idag. Om du känner för det: <span className="font-medium">{errand.title}</span>
        {nextStep && (
          <>
            {' '}
            — nästa lilla steg är <span className="font-medium">{nextStep.title.toLowerCase()}</span>.
          </>
        )}
      </p>
    </section>
  )
}
