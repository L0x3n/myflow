// Supabase Edge Function: flow-chat
// Tar emot { message, history } från appen, hämtar användarens kontext ur DB,
// anropar Anthropic API och returnerar { reply, actions }.
// ANTHROPIC_API_KEY sätts som secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Deploy:  supabase functions deploy flow-chat

import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'claude-sonnet-4-6' // per MASTERPLAN §2

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `Du är Flow, den inbyggda följeslagaren i MyFlow — en app som fungerar
som en andra hjärna för personer med ADHD, autism, stress eller utmattning.

DIN PERSONLIGHET
Du är lugn, varm, trygg och kortfattad. Du dömer aldrig. Du är proaktiv
och lösningsorienterad. Du är inte överdrivet glad, inte tjatig, inte
robotlik. Du skriver på naturlig svenska, som en klok vän — inte som
en assistent eller coach.

SPRÅKREGLER (absoluta)
- Skuldbelägg ALDRIG. Säg "Det blev mycket idag", aldrig "Du missade X".
- Fråga "Hur mycket energi har du idag?", aldrig "Varför gjorde du inte klart?"
- Max 2–3 korta meningar per svar om användaren inte ber om mer.
- Vid låg energi: föreslå MINDRE, aldrig mer. Bekräfta att det är okej.

VAD DU GÖR
- Tar emot hjärndumpar och strukturerar dem till uppgifter och ärenden.
- Föreslår dagens tre viktigaste uppgifter utifrån deadlines, energi
  och konsekvens av att inte göra dem.
- Föreslår FlowPlan: smartaste ordningen (starta det som kan gå
  parallellt först, korta saker i väntetider, dusch/mat i logisk ordning).
- Bryter ner stora uppgifter i små delsteg när något känns för stort.

VAD DU ALDRIG GÖR
- Fattar beslut åt användaren. Du föreslår, hen bestämmer.
- Lägger till press, deadlines eller "borde".
- Räknar upp allt som inte blev gjort.

ACTIONS
- create_task: en fristående uppgift. Sätt estimated_minutes om det går att gissa rimligt.
- create_errand: något större med delsteg (2–6 små, konkreta steg).
- set_top3: max 3 task_ids från kontexten (BEFINTLIGA uppgifter, aldrig påhittade id:n).
- set_flow_order: ordningen för dagens uppgifter, task_ids från kontexten.
- Föreslå aldrig fler än ~8 actions åt gången. actions kan vara tom.`

// Structured output-schema: garanterar { reply, actions } utan parsning-gissningar.
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'actions'],
  properties: {
    reply: {
      type: 'string',
      description: 'Svar till användaren på svenska. Max 2–3 korta meningar.',
    },
    actions: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'title', 'deadline', 'estimated_minutes'],
            properties: {
              type: { const: 'create_task' },
              title: { type: 'string' },
              deadline: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
              estimated_minutes: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'title', 'subtasks'],
            properties: {
              type: { const: 'create_errand' },
              title: { type: 'string' },
              subtasks: { type: 'array', items: { type: 'string' } },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'task_ids'],
            properties: {
              type: { const: 'set_top3' },
              task_ids: { type: 'array', items: { type: 'string' } },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'ordered_task_ids'],
            properties: {
              type: { const: 'set_flow_order' },
              ordered_task_ids: { type: 'array', items: { type: 'string' } },
            },
          },
        ],
      },
    },
  },
}

interface HistoryItem {
  role: 'user' | 'assistant'
  content: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { message, history = [] } = (await req.json()) as {
      message: string
      history?: HistoryItem[]
    }
    if (!message || typeof message !== 'string') {
      return json({ error: 'message saknas' }, 400)
    }

    // Klient med användarens JWT → RLS gäller, vi läser bara hens data.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'inte inloggad' }, 401)

    // Kontext: dagens läge.
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
    const in48h = new Date(Date.now() + 48 * 3600_000).toISOString()
    const [tasks, errands, energy, activities] = await Promise.all([
      supabase
        .from('tasks')
        .select('id,title,status,deadline,estimated_minutes,is_top3,top3_date,flow_order,errand_id')
        .neq('status', 'done')
        .order('created_at'),
      supabase.from('errands').select('id,title,status,deadline').neq('status', 'done'),
      supabase.from('energy_logs').select('level').eq('date', today).maybeSingle(),
      supabase
        .from('activities')
        .select('title,starts_at,location')
        .gte('starts_at', new Date().toISOString())
        .lte('starts_at', in48h)
        .order('starts_at'),
    ])

    const context = {
      idag: today,
      energi: energy.data?.level ?? null, // 1 låg, 2 ok, 3 bra — null = inte angett än
      uppgifter: tasks.data ?? [],
      arenden: errands.data ?? [],
      aktiviteter_48h: activities.data ?? [],
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: `ANVÄNDARENS KONTEXT JUST NU (JSON):\n${JSON.stringify(context)}`,
        },
      ],
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
      messages: [
        ...history.slice(-20).map((h) => ({ role: h.role, content: h.content })),
        { role: 'user' as const, content: message },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return json({ reply: 'Det där kan jag tyvärr inte hjälpa till med. Finns det något annat?', actions: [] })
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    let out: { reply: string; actions: unknown[] } = {
      reply: 'Jag är med dig. Berätta gärna mer.',
      actions: [],
    }
    if (textBlock && 'text' in textBlock) {
      try {
        out = JSON.parse(textBlock.text)
      } catch {
        out = { reply: textBlock.text, actions: [] }
      }
    }
    return json(out)
  } catch (e) {
    console.error('flow-chat error', e)
    return json({ error: 'flow-chat misslyckades' }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
