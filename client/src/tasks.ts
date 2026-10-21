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

// an inclusive run of PR numbers; a single PR is a run of one
type PrRun = { start: number; end: number }

// the kinds of PR task merged across a day, each read by its lead and written
//  back as '<label> PR(s) <refs>'
const PR_TASKS = [
  { lead: /^review(?:ed)?\s+prs?\s+(.+)$/i, label: 'Review' },
  {
    lead: /^address(?:ed)?\s+review\s+findings\s+(?:on|for)\s+prs?\s+(.+)$/i,
    label: 'Address review findings on',
  },
]

const PR_REF = /^(\d+)(?:\s*[–-]\s*(\d+))?$/

// one PR ref, '924' or a range '938–41' whose end may drop the leading digits
//  it shares with the start ('548–9', '723–25'); null if it isn't one
const parsePrRef = (raw: string): PrRun | null => {
  const m = PR_REF.exec(raw.trim())
  if (!m) return null
  const [, from, to] = m
  const start = Number(from)
  if (to === undefined) return { start, end: start }
  const end = Number(to.length < from.length ? `${from.slice(0, from.length - to.length)}${to}` : to)
  return end >= start ? { start, end } : null
}

// split one note into its PR tasks' runs, by kind, and its other tasks. a PR
//  task is a comma-separated segment such as 'Review PR(s) <ref>' plus the bare
//  refs that follow it, so 'Dependabot sweep, Review PRs 871, 872' gives review
//  runs for 871 and 872 and the task 'Dependabot sweep'. text between PR tasks
//  stays one task as typed; anything that breaks the pattern, like 'Review PR
//  924 prettier fix' or 'Review PRs 720, 726 (stack)', is left as ordinary text
//  rather than dropped
const splitPrTasks = (note: string): { runs: PrRun[][]; tasks: string[] } => {
  const runs: PrRun[][] = PR_TASKS.map(() => [])
  const tasks: string[] = []
  let chunk: string[] = []
  let found = false
  let pending: { kind: number; segments: string[]; runs: PrRun[] } | null = null
  // a PR task ending cleanly is taken out; one running into a segment that
  //  starts like a ref but isn't one goes back into the text whole
  const settle = (next: string | null) => {
    if (!pending) return
    if (next !== null && /^\d/.test(next)) {
      chunk.push(...pending.segments)
    } else {
      if (chunk.length) tasks.push(chunk.join(', '))
      chunk = []
      runs[pending.kind].push(...pending.runs)
      found = true
    }
    pending = null
  }
  for (const segment of note.split(',').map((s) => s.trim()).filter(Boolean)) {
    const ref = pending ? parsePrRef(segment) : null
    if (pending && ref) {
      pending.segments.push(segment)
      pending.runs.push(ref)
      continue
    }
    settle(segment)
    const kind = PR_TASKS.findIndex(({ lead }) => lead.test(segment))
    const run = kind >= 0 ? parsePrRef(PR_TASKS[kind].lead.exec(segment)![1]) : null
    if (run) pending = { kind, segments: [segment], runs: [run] }
    else chunk.push(segment)
  }
  settle(null)
  if (chunk.length) tasks.push(chunk.join(', '))
  // a note with no PR task is kept exactly as typed
  return found ? { runs, tasks } : { runs, tasks: [note] }
}

// a range's end shortened to the digits that differ from its start, keeping
//  both digits of a teen: 924–925 -> '5', 938–941 -> '41', 910–911 -> '11',
//  999–1001 -> '1001'
const shortRangeEnd = (start: number, end: number): string => {
  const s = String(start)
  const e = String(end)
  if (s.length !== e.length) return e
  let i = 0
  while (s[i] === e[i]) i++
  const teen = e.length >= 2 && e[e.length - 2] === '1'
  return e.slice(teen ? Math.min(i, e.length - 2) : i)
}

// sorted, deduped, with overlapping and adjacent runs joined, then written out:
//  '871–2, 884, 910–11, 917–25'
export const prRefListString = (runs: PrRun[]): string => {
  const merged: PrRun[] = []
  for (const run of [...runs].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1]
    if (last && run.start <= last.end + 1) last.end = Math.max(last.end, run.end)
    else merged.push({ ...run })
  }
  return merged
    .map((r) => (r.start === r.end ? String(r.start) : `${r.start}–${shortRangeEnd(r.start, r.end)}`))
    .join(', ')
}

// one kind's tasks across the day merged into one, 'Review PRs 884, 910–11',
//  or null when the day has none
const mergedPrTask = (label: string, runs: PrRun[]): string | null => {
  if (!runs.length) return null
  const single = runs.every((r) => r.start === runs[0].start && r.end === r.start)
  return `${label} ${single ? 'PR' : 'PRs'} ${prRefListString(runs)}`
}

// build the deduped task list for a client's day, leading with Standup if
//  present. every review task across the day's notes becomes one 'Review PRs'
//  task, and every address-findings task one 'Address review findings on PRs'
//  task, each with the numbers in order and consecutive runs shown as ranges
export const buildTaskList = (notes: string[]): string[] => {
  const split = notes.map(splitPrTasks)
  const merged = PR_TASKS.map(({ label }, kind) =>
    mergedPrTask(label, split.flatMap((s) => s.runs[kind])),
  ).filter((t): t is string => t !== null)
  const tasks = distinctValues([...split.flatMap((s) => s.tasks), ...merged])
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

// build the deduped project list for a client's day; usually a single project
export const buildProjectNames = (projects: string[]): string[] => distinctValues(projects)

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
//  Hours (B), Task (C), <hidden D, E>, Ticket# (F), then the client-and-project
//  label appended after it. the ticket and label cells are always present, empty
//  or not, so pasted rows line up. hours default to the fixed 2-decimal form
export const taskCopyRow = (
  minutes: number,
  tasks: string[],
  tickets: string[],
  projectLabel: string,
  hours: (minutes: number) => string = decimalHours,
): string =>
  [
    hours(minutes),
    taskListString(tasks),
    ...Array(HIDDEN_COLUMNS).fill(''),
    ticketListString(tickets),
    projectLabel,
  ].join('\t')

// the number of cells taskCopyRow emits (hours, tasks, ticket, label, and the
//  hidden ones), for padding out a blank row to match
export const TASK_COPY_CELLS = 4 + HIDDEN_COLUMNS
