import { useEffect, useRef, useState } from 'react'
import { useStore, type PendingSuggestion } from '../data/store'
import { flowOffline } from '../flow/client'

export default function FlowChat({ draft, onDraftUsed }: { draft: string; onDraftUsed: () => void }) {
  const store = useStore()
  const { snap, flowBusy, suggestions } = store
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const sentDraft = useRef(false)

  useEffect(() => {
    if (draft && !sentDraft.current && snap) {
      sentDraft.current = true
      onDraftUsed()
      void store.sendToFlow(draft)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, snap])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [snap?.chat.length, flowBusy, suggestions])

  if (!snap) return <p className="px-5 pt-12 text-soft">Laddar…</p>

  const send = () => {
    const t = text.trim()
    if (!t || flowBusy) return
    setText('')
    void store.sendToFlow(t)
  }

  const pending = suggestions.filter((s) => s.status !== 'rejected')

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col px-5 pt-8 fade-up">
      <header className="pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Flow</h1>
        {flowOffline && (
          <p className="mt-1 rounded-lg bg-amber-mist px-3 py-1.5 text-xs text-amber">
            Enkelt offline-läge — koppla Supabase för riktiga Flow-svar.
          </p>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {snap.chat.length === 0 && (
          <div className="mt-8 rounded-2xl bg-sage-mist p-6 text-center">
            <p className="text-2xl">💭</p>
            <p className="mt-2 font-medium text-sage-deep">Dumpa allt som ligger i huvudet</p>
            <p className="mt-1 text-sm text-sage-deep/80">
              Rörigt är helt okej. Jag sorterar, du bestämmer.
            </p>
          </div>
        )}

        {snap.chat.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'rounded-br-md bg-sage text-white'
                  : 'rounded-bl-md border border-line bg-card shadow-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {flowBusy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 text-soft shadow-sm">
              Flow tänker<span className="animate-pulse">…</span>
            </div>
          </div>
        )}

        {!flowBusy && pending.map((s) => <SuggestionCard key={s.id} sug={s} />)}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-20 flex items-end gap-2 bg-cream pb-2 pt-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Skriv till Flow…"
          rows={Math.min(4, Math.max(1, text.split('\n').length))}
          className="flex-1 resize-none rounded-2xl border border-line bg-card px-4 py-3 shadow-sm outline-none focus:border-sage"
        />
        <button
          onClick={send}
          disabled={flowBusy || !text.trim()}
          className="h-12 w-12 shrink-0 rounded-full bg-sage text-xl text-white disabled:opacity-40"
          aria-label="Skicka"
        >
          ↑
        </button>
      </div>
    </div>
  )
}

function SuggestionCard({ sug }: { sug: PendingSuggestion }) {
  const store = useStore()
  const snap = store.snap!
  const a = sug.action
  const accepted = sug.status === 'accepted'

  const titleOf = (id: string) => snap.tasks.find((t) => t.id === id)?.title ?? null

  let heading = ''
  let body: string[] = []
  let acceptLabel = 'Lägg till'
  if (a.type === 'create_task') {
    heading = a.title
    body = a.estimated_minutes ? [`ca ${a.estimated_minutes} min`] : []
  } else if (a.type === 'create_errand') {
    heading = a.title
    body = a.subtasks
  } else if (a.type === 'set_top3') {
    heading = 'Förslag: dagens tre'
    body = a.task_ids.map(titleOf).filter((x): x is string => x !== null)
    acceptLabel = 'Använd'
    if (body.length === 0) return null
  } else {
    heading = 'Förslag: smart ordning'
    body = a.ordered_task_ids.map(titleOf).filter((x): x is string => x !== null)
    acceptLabel = 'Använd ordningen'
    if (body.length === 0) return null
  }

  return (
    <div
      className={`ml-2 rounded-2xl border p-4 fade-up ${
        accepted ? 'border-sage/40 bg-sage-mist/60' : 'border-sage/40 bg-card shadow-sm'
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-faint">
        {a.type === 'create_task' ? 'Uppgift' : a.type === 'create_errand' ? 'Ärende' : 'Flow föreslår'}
      </p>
      <p className="mt-0.5 font-medium">{heading}</p>
      {body.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-sm text-soft">
          {body.map((b, i) => (
            <li key={i}>
              {a.type === 'set_flow_order' || a.type === 'set_top3' ? `${i + 1}. ` : '· '}
              {b}
            </li>
          ))}
        </ul>
      )}
      {accepted ? (
        <p className="mt-3 text-sm font-medium text-sage-deep">Tillagd ✓</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void store.acceptSuggestion(sug.id)}
            className="rounded-full bg-sage px-4 py-2 text-sm font-medium text-white"
          >
            {acceptLabel}
          </button>
          <button
            onClick={() => store.rejectSuggestion(sug.id)}
            className="rounded-full px-4 py-2 text-sm text-soft"
          >
            Nej tack
          </button>
        </div>
      )}
    </div>
  )
}
