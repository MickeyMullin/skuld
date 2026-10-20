// server/src/tickets.ts

// a port of the ticket rules in client/src/tasks.ts, so the summary lists the
//  same tickets the day-copy dialog does. tickets.test.ts holds the two in step

// drop blanks and dedupe case-insensitively (keeping first-seen casing), then
//  alphabetize case-insensitively
const distinctValues = (values: string[]): string[] => {
  const seen = new Map<string, string>()
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (!seen.has(key)) seen.set(key, value)
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  )
}

// one entry's ticket field can hold several refs, e.g. 'RES-1113, 2280'
export const splitTickets = (raw: string): string[] =>
  raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

// the deduped ticket list for a set of entries, flattening multi-ticket fields
//  so a ref shared by two entries is only listed once
export const buildTicketList = (tickets: string[]): string[] =>
  distinctValues(tickets.flatMap(splitTickets))
