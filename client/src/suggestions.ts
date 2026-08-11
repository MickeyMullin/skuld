// client/src/suggestions.ts

import type { Entry } from './api'
import { normalizeTicketField, splitTickets } from './tasks'

// an autocomplete candidate, carrying the rest of the entry it came from so
//  accepting it can fill the sibling fields too
export type Suggestion = {
  value: string
  ticket: string
  client: string
}

// dedupe candidates case-insensitively. they arrive in start-time order and later
//  ones overwrite earlier, so the most recent use of a value wins — repeating the
//  latest version of a task is the common case
const dedupe = (candidates: Suggestion[]): Suggestion[] => {
  const seen = new Map<string, Suggestion>()
  for (const c of candidates) {
    if (!c.value) continue
    seen.set(c.value.toLowerCase(), c)
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.value.toLowerCase().localeCompare(b.value.toLowerCase()),
  )
}

export const buildNoteSuggestions = (entries: Entry[]): Suggestion[] =>
  dedupe(
    entries.map((e) => ({
      value: e.note.trim(),
      // the whole field, so completing a note brings all of its refs along
      ticket: normalizeTicketField(e.ticket),
      client: e.client,
    })),
  )

// each ref is offered on its own, so typing '2280' still finds an entry filed
//  under 'RES-1113, 2280'. multi-ticket fields are additionally offered whole,
//  for repeating the same combination
export const buildTicketSuggestions = (entries: Entry[]): Suggestion[] =>
  dedupe(
    entries.flatMap((e) => {
      const refs = splitTickets(e.ticket)
      const values = refs.length > 1 ? [...refs, refs.join(', ')] : refs
      return values.map((value) => ({ value, ticket: value, client: e.client }))
    }),
  )
