# MyFlow

En andra hjärna för personer med ADHD, autism, stress eller utmattning.
North Star: **"Minskar detta människors mentala belastning?"**

**Live:** https://l0x3n.github.io/myflow/ (installerbar PWA — "Lägg till på hemskärmen").
Deploya om med `./deploy.ps1`. Repo: https://github.com/L0x3n/myflow

Se [MASTERPLAN.md](MASTERPLAN.md) för hela planen och [BACKLOG.md](BACKLOG.md) för det som medvetet väntar.

## Köra lokalt

```sh
pnpm install
pnpm dev          # http://localhost:5212
pnpm typecheck
pnpm build
```

Utan `.env` körs appen i **lokalt läge**: all data sparas i webbläsarens localStorage
och Flow svarar med en enkel offline-heuristik. Perfekt för att testa UI:t direkt.

## Koppla Supabase (konto, synk, riktiga Flow AI)

1. Skapa ett projekt på [supabase.com](https://supabase.com).
2. **Databas:** SQL Editor → klistra in hela [supabase/schema.sql](supabase/schema.sql) → Run.
3. **Auth:** Authentication → Providers → Email: slå PÅ, och stäng AV "Confirm email"
   (magic link räcker). Lägg till appens URL under Authentication → URL Configuration
   → Redirect URLs (t.ex. `http://localhost:5212` och produktions-URL:en).
4. **Env:** kopiera `.env.example` → `.env`, fyll i `VITE_SUPABASE_URL` och
   `VITE_SUPABASE_ANON_KEY` från Project Settings → API. Starta om `pnpm dev`.
5. **Flow AI (Edge Function):**
   ```sh
   npx supabase login
   npx supabase link --project-ref <ditt-projekt-ref>
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   npx supabase functions deploy flow-chat
   ```

## Deploy

Nu: GitHub Pages via `./deploy.ps1` (bygger med base `/myflow/`, force-pushar `dist/`
till gh-pages). OBS: GitHub Pages är publikt och kan inte läsa `.env` vid bygge —
kör deployen från en maskin med `.env` ifylld när Supabase ska med i bygget.

Alternativ (masterplanens förstaval när det är dags): Vercel/Netlify — statisk
Vite-app, build `pnpm build`, output `dist/`, sätt `VITE_SUPABASE_URL` +
`VITE_SUPABASE_ANON_KEY` som env-variabler där. Lägg till produktions-URL:en i
Supabase Redirect URLs. `ANTHROPIC_API_KEY` bor ENDAST i Supabase Edge Function
secrets — aldrig i frontend.

## Notiser (MVP-nivå)

Slås på under Mer → Notiser. Medicin påminns vid schemalagd tid (tills avbockad),
aktiviteter 30 min innan — medan appen är öppen eller ligger i bakgrunden.
Äkta push när appen är helt stängd kräver backend-cron: se BACKLOG.md.

## Struktur

```
src/
  types.ts          Datamodell + Flow-actions
  lib/              supabase-klient, väder (Open-Meteo), datumhjälp
  data/db.ts        DB-abstraktion: LocalDB (localStorage) / CloudDB (Supabase)
  data/store.tsx    React-store + optimistiska mutationer + selektorer
  flow/client.ts    Flow-anrop (edge function i molnläge, heuristik offline)
  views/            Idag, Flow, Ärenden, Mer, Fokus ("Hjälp mig")
  components/       AuthGate (magic link)
supabase/
  schema.sql        Tabeller + RLS
  functions/flow-chat/  Edge Function som pratar med Anthropic API
```

## Designprinciper (MASTERPLAN §3 — icke förhandlingsbara)

Lugn framför produktivitet · visa bara det som är viktigt nu · en sak i taget ·
få klick · språket dömer aldrig · mobil (~380 px) först.
