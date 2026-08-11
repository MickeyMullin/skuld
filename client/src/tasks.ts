// client/src/tasks.ts

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

// build the deduped task list for a client's day, leading with Standup if present
export const buildTaskList = (notes: string[]): string[] => {
  const tasks = distinctValues(notes)
  const standup = tasks.find((t) => t.toLowerCase() === 'standup')
  if (!standup) return tasks
  return ['Standup', ...tasks.filter((t) => t !== standup)]
}

// one entry's ticket field can hold several refs, e.g. 'RES-1113, 2280', so it
//  has to be broken apart before anything counts or compares tickets
export const splitTickets = (raw: string): string[] =>
  raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

// tidy a single entry's ticket field: consistent ', ' separators, no stray or
//  empty segments. order is left as typed — it's the user's own entry
export const normalizeTicketField = (raw: string): string =>
  splitTickets(raw).join(', ')

// build the deduped ticket list for a client's day, flattening multi-ticket
//  entries so a ref shared by two entries is only listed once
export const buildTicketList = (tickets: string[]): string[] =>
  distinctValues(tickets.flatMap(splitTickets))

// comma-separated rendering of the task list
export const taskListString = (tasks: string[]): string => tasks.join(', ')

// comma-separated rendering of the ticket list
export const ticketListString = (tickets: string[]): string => tickets.join(', ')

// minutes as 2-decimal hours, e.g. 75 -> "1.25" (for copying to another system)
export const decimalHours = (minutes: number): string => (minutes / 60).toFixed(2)

// the target spreadsheet hides two columns (D and E) between Task and Ticket#,
//  so the pasted row has to skip over them to land the ticket in column F
const HIDDEN_COLUMNS = 2

// tab-separated row for the clipboard, laid out as the spreadsheet's
//  Hours (B), Task (C), <hidden D, E>, Ticket# (F). the ticket cell is always
//  present, empty or not, so pasted rows line up
export const taskCopyRow = (
  minutes: number,
  tasks: string[],
  tickets: string[],
): string =>
  [
    decimalHours(minutes),
    taskListString(tasks),
    ...Array(HIDDEN_COLUMNS).fill(''),
    ticketListString(tickets),
  ].join('\t')
