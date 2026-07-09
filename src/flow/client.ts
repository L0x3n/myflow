import { supabase } from '../lib/supabase'
import type { FlowAction, FlowResult } from '../types'

export interface FlowHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Skickar ett meddelande till Flow.
 * Molnläge: Supabase Edge Function `flow-chat` (Anthropic API, nyckeln bor där).
 * Lokalt läge: enkel heuristik så att flödet går att använda/testa utan moln.
 */
export async function askFlow(message: string, history: FlowHistoryItem[]): Promise<FlowResult> {
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('flow-chat', {
      body: { message, history: history.slice(-20) },
    })
    if (error) throw error
    const d = data as Partial<FlowResult>
    return {
      reply: typeof d.reply === 'string' ? d.reply : 'Jag är med dig. Berätta mer.',
      actions: Array.isArray(d.actions) ? (d.actions as FlowAction[]) : [],
    }
  }
  return heuristicFlow(message)
}

export const flowOffline = !supabase

/** Offline-fallback: dela upp en hjärndump i uppgiftsförslag, rad/mening för sig. */
function heuristicFlow(message: string): FlowResult {
  const breakdown = message.match(/^bryt ner\s+["”']?([^"”']+?)["”']?\s+i små steg/i)
  if (breakdown) {
    return {
      reply:
        'Här är ett förslag på små steg — ändra som du vill. (Flow AI är inte inkopplad än, så det här är en enkel mall.)',
      actions: [
        {
          type: 'create_errand',
          title: breakdown[1],
          subtasks: [
            'Ta fram det du behöver',
            'Gör en första liten del — 5 minuter räcker',
            'Fortsätt en bit till om det känns okej',
            'Avsluta och lägg undan',
          ],
        },
      ],
    }
  }

  const parts = message
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^[-•*]\s*/, '').replace(/[.!]+$/, ''))
    .filter((s) => s.length >= 3)
    .slice(0, 8)

  if (parts.length === 0) {
    return { reply: 'Berätta gärna mer, så hjälper jag dig sortera.', actions: [] }
  }

  return {
    reply:
      'Jag delade upp det du skrev. Lägg till det som känns rätt — resten kan vänta. (Enkelt offline-läge: koppla Supabase + AI för riktiga Flow-svar.)',
    actions: parts.map((title) => ({ type: 'create_task' as const, title })),
  }
}
