import { useState } from 'react'
import { useStore } from '../data/store'
import { cloudMode, supabase } from '../lib/supabase'
import { getPlace, searchPlace, setPlace } from '../lib/weather'
import type { Medication } from '../types'

export default function More({ userEmail }: { userEmail?: string }) {
  return (
    <div className="px-5 pt-8 space-y-5 fade-up">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mer</h1>
      </header>
      <MedsSettings />
      <PlaceSettings />
      <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
        <h2 className="font-medium">Notiser</h2>
        <p className="mt-1 text-sm text-soft">Påminnelser om medicin och aktiviteter kommer i nästa steg.</p>
      </section>
      <FrictionBox />
      <AccountBox userEmail={userEmail} />
    </div>
  )
}

// ------------------------------------------------------------------ mediciner

function MedsSettings() {
  const store = useStore()
  const snap = store.snap!
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Mediciner</h2>
        <button onClick={() => setEditing('new')} className="text-sm text-sage-deep">
          + Lägg till
        </button>
      </div>
      {snap.medications.length === 0 && editing !== 'new' && (
        <p className="mt-2 text-sm text-soft">Lägg till medicin så dyker den upp som en lugn checklista på Idag.</p>
      )}
      <div className="mt-2 space-y-2">
        {snap.medications.map((m) =>
          editing === m.id ? (
            <MedForm key={m.id} med={m} onDone={() => setEditing(null)} />
          ) : (
            <button
              key={m.id}
              onClick={() => setEditing(m.id)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-cream px-4 py-3 text-left"
            >
              <span>{m.name}</span>
              <span className="text-sm text-faint">{m.times.join(' · ')}</span>
            </button>
          ),
        )}
        {editing === 'new' && <MedForm onDone={() => setEditing(null)} />}
      </div>
    </section>
  )
}

function MedForm({ med, onDone }: { med?: Medication; onDone: () => void }) {
  const store = useStore()
  const [name, setName] = useState(med?.name ?? '')
  const [times, setTimes] = useState(med?.times.join(', ') ?? '')
  const [err, setErr] = useState('')

  const save = async () => {
    const parsed = times
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((t) => {
        const m = t.match(/^(\d{1,2})[:.](\d{2})$/)
        return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
      })
    if (!name.trim() || parsed.length === 0 || parsed.some((p) => p === null)) {
      setErr('Skriv namn och tider som 08:00, 20:00')
      return
    }
    await store.saveMedication({ id: med?.id, name: name.trim(), times: parsed as string[] })
    onDone()
  }

  return (
    <div className="rounded-xl border border-sage/40 bg-cream p-3 space-y-2 fade-up">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Namn, t.ex. Elvanse"
        className="w-full rounded-lg border border-line bg-card px-3 py-2.5 outline-none focus:border-sage"
      />
      <input
        value={times}
        onChange={(e) => setTimes(e.target.value)}
        placeholder="Tider, t.ex. 08:00, 20:00"
        className="w-full rounded-lg border border-line bg-card px-3 py-2.5 outline-none focus:border-sage"
      />
      {err && <p className="text-xs text-terra">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 rounded-lg bg-sage py-2.5 text-sm text-white">
          Spara
        </button>
        <button onClick={onDone} className="rounded-lg px-3 py-2.5 text-sm text-soft">
          Avbryt
        </button>
        {med && (
          <button
            onClick={async () => {
              await store.deleteMedication(med.id)
              onDone()
            }}
            className="rounded-lg px-3 py-2.5 text-sm text-terra/80"
          >
            Ta bort
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------- plats

function PlaceSettings() {
  const [place, setPlaceState] = useState(getPlace())
  const [query, setQuery] = useState('')
  const [msg, setMsg] = useState('')

  const search = async () => {
    if (!query.trim()) return
    setMsg('Söker…')
    const p = await searchPlace(query.trim())
    if (p) {
      setPlace(p)
      setPlaceState(p)
      setQuery('')
      setMsg('')
    } else {
      setMsg('Hittade inte den orten — prova en större ort i närheten.')
    }
  }

  const useGps = () => {
    setMsg('Hämtar din plats…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { name: 'Din plats', lat: pos.coords.latitude, lon: pos.coords.longitude }
        setPlace(p)
        setPlaceState(p)
        setMsg('')
      },
      () => setMsg('Kunde inte hämta platsen. Sök på ort istället.'),
    )
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <h2 className="font-medium">Plats för väder</h2>
      <p className="mt-1 text-sm text-soft">
        Nu: <span className="text-ink">{place.name}</span>
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Sök ort…"
          className="flex-1 rounded-xl border border-line bg-cream px-4 py-3 outline-none focus:border-sage"
        />
        <button onClick={search} className="rounded-xl bg-sage-mist px-4 text-sage-deep">
          Sök
        </button>
      </div>
      <button onClick={useGps} className="mt-2 text-sm text-sage-deep">
        📍 Använd min plats
      </button>
      {msg && <p className="mt-2 text-xs text-soft">{msg}</p>}
    </section>
  )
}

// ------------------------------------------------------------------- friktion

function FrictionBox() {
  const store = useStore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [freq, setFreq] = useState(3)
  const [load, setLoad] = useState(3)
  const [sent, setSent] = useState(false)

  const send = async () => {
    if (!text.trim()) return
    await store.addFriction(text.trim(), freq, load)
    setSent(true)
    setText('')
    setTimeout(() => {
      setSent(false)
      setOpen(false)
    }, 2500)
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <div>
          <h2 className="font-medium">Något som skaver?</h2>
          <p className="mt-0.5 text-sm text-soft">Berätta — det hjälper appen bli bättre.</p>
        </div>
        <span className="text-faint">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 fade-up">
          {sent ? (
            <p className="rounded-xl bg-sage-mist px-4 py-3 text-sm text-sage-deep">Tack. Det betyder mycket. 🤍</p>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Vad känns tungt eller krångligt?"
                rows={3}
                className="w-full resize-none rounded-xl border border-line bg-cream px-4 py-3 outline-none focus:border-sage"
              />
              <Scale label="Hur ofta händer det?" value={freq} onChange={setFreq} />
              <Scale label="Hur tungt känns det?" value={load} onChange={setLoad} />
              <button onClick={send} className="w-full rounded-xl bg-sage py-3 text-white">
                Skicka
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-sm text-soft">{label}</p>
      <div className="mt-1.5 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-full border text-sm ${
              value === n ? 'border-sage bg-sage text-white' : 'border-line bg-cream text-soft'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------- konto

function AccountBox({ userEmail }: { userEmail?: string }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-sm border border-line">
      <h2 className="font-medium">Konto</h2>
      {cloudMode ? (
        <>
          <p className="mt-1 text-sm text-soft">{userEmail ?? 'Inloggad'}</p>
          <button
            onClick={() => void supabase!.auth.signOut()}
            className="mt-3 rounded-xl border border-line px-4 py-2.5 text-sm text-soft"
          >
            Logga ut
          </button>
        </>
      ) : (
        <p className="mt-1 text-sm text-soft">
          Lokalt läge — allt sparas bara på den här enheten. Koppla Supabase (se README) för konto, synk och Flow AI.
        </p>
      )}
      <p className="mt-4 text-xs text-faint">MyFlow 0.1 · byggd för lugn, inte produktivitet</p>
    </section>
  )
}
