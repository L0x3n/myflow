import { useMemo, useState } from 'react'
import { openTodos, top3Today, useStore } from '../data/store'

/**
 * "Hjälp mig"-läget: EN uppgift åt gången på lugn helskärm.
 * Klar → nästa. Hoppa över → läggs sist, utan kommentar.
 */
export default function Focus({
  onClose,
  onBreakdown,
}: {
  onClose: () => void
  onBreakdown: (title: string) => void
}) {
  const store = useStore()
  const snap = store.snap!

  const initialQueue = useMemo(() => {
    const three = top3Today(snap).filter((t) => t.status !== 'done')
    const rest = openTodos(snap).filter((t) => !three.some((x) => x.id === t.id))
    return [...three, ...rest].map((t) => t.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [queue, setQueue] = useState<string[]>(initialQueue)
  const [doneCount, setDoneCount] = useState(0)

  const current = queue.map((id) => snap.tasks.find((t) => t.id === id)).find((t) => t && t.status !== 'done')

  const markDone = () => {
    if (!current) return
    store.toggleTaskDone(current.id)
    setQueue((q) => q.filter((id) => id !== current.id))
    setDoneCount((n) => n + 1)
  }

  const skip = () => {
    if (!current) return
    setQueue((q) => [...q.filter((id) => id !== current.id), current.id])
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-sage-deep to-sage text-white">
      <button onClick={onClose} className="absolute right-5 top-5 text-2xl text-white/70" aria-label="Stäng">
        ✕
      </button>

      {current ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center fade-up" key={current.id}>
          <p className="text-sm uppercase tracking-widest text-white/60">En sak i taget</p>
          <h1 className="mt-4 text-3xl font-semibold leading-snug">{current.title}</h1>
          {current.estimated_minutes && <p className="mt-2 text-white/70">ca {current.estimated_minutes} min</p>}

          <div className="mt-12 w-full max-w-xs space-y-3">
            <button
              onClick={markDone}
              className="w-full rounded-2xl bg-white py-4 text-lg font-medium text-sage-deep shadow-lg active:scale-[0.99]"
            >
              Klar
            </button>
            <button onClick={skip} className="w-full rounded-2xl border border-white/40 py-3.5 text-white/90">
              Hoppa över
            </button>
            <button onClick={() => onBreakdown(current.title)} className="w-full py-2 text-sm text-white/70">
              Bryt ner den åt mig
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center fade-up">
          <p className="text-4xl">🌿</p>
          <h1 className="mt-4 text-2xl font-semibold">
            {doneCount > 0 ? 'Se där. Klart för nu.' : 'Inget som väntar just nu.'}
          </h1>
          <p className="mt-2 text-white/80">
            {doneCount > 0 ? `${doneCount} ${doneCount === 1 ? 'sak' : 'saker'} avklarade.` : 'Vila är också något.'}
          </p>
          <button
            onClick={onClose}
            className="mt-10 rounded-2xl bg-white px-8 py-3.5 font-medium text-sage-deep shadow-lg"
          >
            Tillbaka
          </button>
        </div>
      )}
    </div>
  )
}
