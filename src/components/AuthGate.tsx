import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type AuthState =
  | { kind: 'loading' }
  | { kind: 'out' }
  | { kind: 'sent'; email: string }
  | { kind: 'in'; userId: string; email?: string }

/** Magic link-inloggning. Renderas bara i molnläge (supabase != null). */
export default function AuthGate({
  children,
}: {
  children: (userId: string, email?: string) => ReactNode
}) {
  const [state, setState] = useState<AuthState>({ kind: 'loading' })
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    void supabase!.auth.getSession().then(({ data }) => {
      setState((s) =>
        data.session
          ? { kind: 'in', userId: data.session.user.id, email: data.session.user.email }
          : s.kind === 'loading'
            ? { kind: 'out' }
            : s,
      )
    })
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, session) => {
      setState(session ? { kind: 'in', userId: session.user.id, email: session.user.email } : { kind: 'out' })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (state.kind === 'in') return <>{children(state.userId, state.email)}</>
  if (state.kind === 'loading') return <div className="flex min-h-dvh items-center justify-center text-soft">…</div>

  const sendLink = async () => {
    const e = email.trim()
    if (!e.includes('@')) {
      setErr('Skriv din mejladress.')
      return
    }
    setErr('')
    const { error } = await supabase!.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setErr('Gick inte att skicka länken. Prova igen om en stund.')
    else setState({ kind: 'sent', email: e })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm text-center fade-up">
        <p className="text-4xl">🌿</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">MyFlow</h1>
        <p className="mt-1 text-soft">En andra hjärna som gör dagen lättare.</p>

        {state.kind === 'sent' ? (
          <div className="mt-8 rounded-2xl bg-sage-mist p-6 text-sage-deep">
            <p className="font-medium">Kolla din mejl 💌</p>
            <p className="mt-1 text-sm">
              Vi skickade en inloggningslänk till {state.email}. Inget lösenord behövs.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendLink()}
              placeholder="din@mejl.se"
              className="w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-center shadow-sm outline-none focus:border-sage"
            />
            <button onClick={() => void sendLink()} className="w-full rounded-2xl bg-sage py-3.5 font-medium text-white">
              Skicka inloggningslänk
            </button>
            {err && <p className="text-sm text-terra">{err}</p>}
            <p className="pt-2 text-xs text-faint">Inga lösenord — du får en länk i mejlen varje gång.</p>
          </div>
        )}
      </div>
    </div>
  )
}
