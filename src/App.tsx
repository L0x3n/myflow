import { useEffect, useRef, useState } from 'react'
import { StoreProvider, useStore } from './data/store'
import { cloudMode } from './lib/supabase'
import { notifyTick } from './lib/notify'
import AuthGate from './components/AuthGate'
import Today from './views/Today'
import FlowChat from './views/FlowChat'
import Errands from './views/Errands'
import More from './views/More'
import Focus from './views/Focus'

type View = 'today' | 'flow' | 'errands' | 'more'

const NAV: { view: View; label: string; icon: string }[] = [
  { view: 'today', label: 'Idag', icon: '☀️' },
  { view: 'flow', label: 'Flow', icon: '💭' },
  { view: 'errands', label: 'Ärenden', icon: '📋' },
  { view: 'more', label: 'Mer', icon: '⋯' },
]

export default function App() {
  if (!cloudMode) return <Shell />
  return <AuthGate>{(userId, email) => <Shell userId={userId} email={email} />}</AuthGate>
}

function Shell({ userId, email }: { userId?: string; email?: string }) {
  const [view, setView] = useState<View>('today')
  const [focusOpen, setFocusOpen] = useState(false)
  const [flowDraft, setFlowDraft] = useState('')

  return (
    <StoreProvider userId={userId}>
      <NotificationAgent />
      <div className="mx-auto min-h-dvh max-w-md pb-24 font-sans">
        <LoadErrorBanner />
        {view === 'today' && <Today onHelp={() => setFocusOpen(true)} />}
        {view === 'flow' && <FlowChat draft={flowDraft} onDraftUsed={() => setFlowDraft('')} />}
        {view === 'errands' && <Errands />}
        {view === 'more' && <More userEmail={email} />}

        {focusOpen && (
          <Focus
            onClose={() => setFocusOpen(false)}
            onBreakdown={(title) => {
              setFocusOpen(false)
              setFlowDraft(`Bryt ner "${title}" i små steg`)
              setView('flow')
            }}
          />
        )}

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/90 backdrop-blur">
          <div className="mx-auto flex max-w-md items-stretch pb-[env(safe-area-inset-bottom)]">
            {NAV.map((n) => (
              <button
                key={n.view}
                onClick={() => setView(n.view)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                  view === n.view ? 'text-sage-deep' : 'text-faint'
                }`}
                aria-label={n.label}
                aria-current={view === n.view ? 'page' : undefined}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full text-lg ${
                    view === n.view ? 'bg-sage-mist' : ''
                  }`}
                >
                  {n.icon}
                </span>
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </StoreProvider>
  )
}

/** Kollar var 30:e sekund om någon medicin/aktivitet ska påminnas om. */
function NotificationAgent() {
  const { snap } = useStore()
  const snapRef = useRef(snap)
  snapRef.current = snap
  useEffect(() => {
    const id = setInterval(() => notifyTick(snapRef.current), 30_000)
    notifyTick(snapRef.current)
    return () => clearInterval(id)
  }, [])
  return null
}

function LoadErrorBanner() {
  const { loadError, reload } = useStore()
  if (!loadError) return null
  return (
    <button
      onClick={() => void reload()}
      className="mx-5 mt-4 block w-[calc(100%-2.5rem)] rounded-xl bg-amber-mist px-4 py-3 text-left text-sm text-amber"
    >
      Kunde inte hämta din data — kolla uppkopplingen och tryck här för att prova igen.
    </button>
  )
}
