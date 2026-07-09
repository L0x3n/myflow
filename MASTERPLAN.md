# MyFlow — MASTERPLAN (MVP)

> Startdokument för Claude Code. Läs hela innan du skriver kod.
> North Star: **"Minskar detta människors mentala belastning?"** Om nej — bygg inte.

---

## 1. Vad vi bygger

En webbapp (PWA, mobilanpassad från dag 1) som fungerar som "en andra hjärna" för personer med ADHD, autism, stress eller utmattning. MVP:n testar EN hypotes:

**"Om appen visar rätt tre saker idag och Flow känns empatisk, minskar användarens stress."**

Allt som inte testar den hypotesen skjuts upp. Se avsnitt 9 (Scope-vakt).

### Målgrupp för MVP
En (1) testanvändare ur målgruppen + Kevin själv. Inte fler förrän vecka 4 är klar.

---

## 2. Stack

| Del | Val | Motivering |
|---|---|---|
| Frontend | React + TypeScript + Vite | Snabbt, välkänt, Claude Code-vänligt |
| Styling | Tailwind CSS | Snabb iteration, konsekvent design |
| Backend/DB/Auth | Supabase | Auth + Postgres + RLS + Edge Functions i ett. Gratis-tier räcker. RLS ger familjedelning "gratis" senare |
| AI | Anthropic API (claude-sonnet-4-6) via Supabase Edge Function | API-nyckeln får ALDRIG ligga i frontend |
| Väder | Open-Meteo | Gratis, ingen API-nyckel |
| Notiser | Web Push API (PWA) | Medicinpåminnelser + nästa aktivitet |
| Hosting | Vercel eller Netlify | Gratis, auto-deploy från Git |

### Auth
Magic link via e-post (Supabase inbyggt). Inga lösenord — mindre friktion, passar målgruppen.

---

## 3. Designprinciper (icke förhandlingsbara)

Från Living Blueprint kap 9:

1. **Lugn framför produktivitet.** Inga röda badges, inga räknare som skriker "5 missade!". Dämpad färgpalett, varma toner. Varningsfärg endast vid verkligt kritiska saker (medicin, deadline idag).
2. **Visa bara det som är viktigt nu.** Idag-vyn visar max: dagens tre, nästa aktivitet, medicin, väder. Allt annat ligger bakom navigation.
3. **En sak i taget.** "Hjälp mig"-läget visar EN uppgift åt gången, med "Klar" och "Hoppa över".
4. **Få klick.** Lägga till en uppgift: max 2 interaktioner. Bocka av: 1.
5. **Språket dömer aldrig.** Missade uppgifter försvinner tyst till imorgon med texten "Det blev mycket idag" — aldrig "Du missade X".
6. Mobilvy (~380 px) är primär. Desktop är sekundär.

---

## 4. Datamodell (Supabase)

Se [supabase/schema.sql](supabase/schema.sql) — tabellerna tasks, errands, medications,
medication_logs, energy_logs, activities, frictions, chat_messages. Alla har
`user_id references auth.users` + RLS-policy: användaren ser bara sina egna rader.

### Energinivåns effekt (kärnmekanik!)
- Nivå 1 (låg): Idag-vyn visar EN uppgift + medicin. Inget annat.
- Nivå 2 (ok): Dagens tre + nästa aktivitet + medicin.
- Nivå 3 (bra): Full vy + Flows förslag att beta av något större.

---

## 5. Flow AI

Supabase Edge Function `flow-chat` (se supabase/functions/flow-chat/index.ts):
1. Tar emot användarens meddelande + de senaste ~20 meddelandena.
2. Hämtar kontext: dagens uppgifter, ärenden, energinivå, aktiviteter.
3. Anropar Anthropic API (claude-sonnet-4-6, structured outputs) med systemprompt + kontext + historik.
4. Returnerar `{ reply, actions }` — frontend visar förslagen som kort med
   "Lägg till"/"Nej tack". Flow FÖRESLÅR, användaren BESTÄMMER. Ingen action utan klick.

Actions: `create_task`, `create_errand` (med subtasks), `set_top3` (task_ids),
`set_flow_order` (ordered_task_ids).

FlowPlan i MVP = Flows `set_flow_order`-förslag; ingen egen algoritm.

---

## 6. Vyer

1. **Idag** (start) — energifrågan (första gången per dag), dagens tre, nästa aktivitet, medicin-checkbox, väder + väderråd, knappen "Hjälp mig".
2. **Flow** — chattvy. "Dumpa allt som ligger i huvudet". Förslagskort med godkänn/avvisa.
3. **Ärenden** — ärenden med delsteg + status (Väntar på / Pågår / Klart) + fristående uppgifter.
4. **Hjälp mig** — helskärmsläge: EN uppgift, lugn bakgrund, "Klar" / "Hoppa över" / "Bryt ner den åt mig".
5. **Mer** — mediciner, notiser, plats (väder), logga ut, friktionsknapp.

Navigation: bottenmeny med 4 ikoner (Idag, Flow, Ärenden, Mer).

---

## 7. Byggordning

### Vecka 1 — Skelett och kärna
- [x] Vite + React + TS + Tailwind, projektstruktur
- [x] Tabeller + RLS (schema.sql klar — körs i Supabase av Kevin)
- [x] Auth med magic link, skyddade routes (aktiveras när .env finns)
- [x] Idag-vyn: energifråga, dagens tre, nästa aktivitet, medicin-check, väder
- [x] Ärenden-vyn: CRUD för ärenden + delsteg + status
- [ ] Deploy till Vercel/Netlify
- **Milstolpe:** Kevin använder appen en hel dag på mobilen.

### Vecka 2 — Flow AI
- [x] Edge Function `flow-chat` med systemprompt + kontexthämtning (deploy = Kevins steg)
- [x] Chattvy med historik (sparas i `chat_messages`)
- [x] Förslagskort: create_task, create_errand, set_top3, set_flow_order
- [x] Hjärndump-flöde: klistra in rörig text → strukturerade förslag
- [x] Väderråd på Idag-vyn (regelbaserat tills vidare)
- **Milstolpe:** En rörig måndagsdump blir en vettig dag med tre prioriterade uppgifter i smart ordning.

### Vecka 3 — PWA, notiser, polering
- [ ] PWA: manifest, service worker, installerbar på hemskärm
- [ ] Push-notiser: medicin (vid schemalagd tid), nästa aktivitet (30 min innan)
- [x] "Hjälp mig"-läget
- [x] Friktionsknapp i inställningar
- [x] Empatisk "dagen är slut"-hantering: ogjorda uppgifter flyttas tyst till imorgon
- [ ] Designgenomgång mot avsnitt 3
- **Milstolpe:** Testanvändaren får sitt konto och installerar på hemskärmen.

### Vecka 4 — Bara lyssna
- [ ] INGA nya funktioner
- [ ] Daglig användning av testanvändaren, Kevin loggar friktioner
- [ ] Iterera ENDAST på: Flows ton, Idag-vyns innehåll, buggar
- **Milstolpe/gate:** Har testanvändaren öppnat appen ≥5 dagar av 7 under vecka 4? Ja → planera vecka 5 utifrån friktionerna. Nej → fixa kärnan, bygg inget nytt.

---

## 8. Miljövariabler

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
# Endast i Supabase Edge Function secrets, ALDRIG i frontend:
ANTHROPIC_API_KEY=
```

---

## 9. Scope-vakt — byggs INTE i MVP

Se [BACKLOG.md](BACKLOG.md). Om en idé dyker upp under bygget: skriv ner den där och fortsätt.
