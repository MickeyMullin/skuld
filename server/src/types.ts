// server/src/types.ts

export type Entry = {
  id: number
  date: string
  startedAt: string
  endedAt: string
  note: string
  ticket: string
  client: string
  project: string
  // caller-supplied idempotency key; null for entries posted without one
  externalId: string | null
  createdAt: string
}

export type EntryRow = {
  id: number
  date: string
  started_at: string
  ended_at: string
  note: string
  ticket: string
  client: string
  project: string
  external_id: string | null
  created_at: string
}

export type CreateEntryInput = {
  date: string
  startedAt: string
  endedAt: string
  note?: string
  ticket?: string
  client: string
  project?: string
  externalId?: string
}

// null or blank clears an entry's externalId
export type UpdateEntryInput = Partial<Omit<CreateEntryInput, 'externalId'>> & {
  externalId?: string | null
}

export const rowToEntry = (row: EntryRow): Entry => ({
  id: row.id,
  date: row.date,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  note: row.note,
  ticket: row.ticket,
  client: row.client,
  project: row.project,
  externalId: row.external_id,
  createdAt: row.created_at,
})

export type Client = {
  id: number
  code: string
  name: string
  active: boolean
  ordinal: number
}

export type ClientRow = {
  id: number
  code: string
  name: string
  active: number
  ordinal: number
}

export const rowToClient = (row: ClientRow): Client => ({ ...row, active: row.active !== 0 })

// a project belongs to one client; the same name under two clients is two projects
export type Project = {
  id: number
  clientId: number
  client: string
  name: string
  active: boolean
  ordinal: number
}

export type ProjectRow = {
  id: number
  client_id: number
  client: string
  name: string
  active: number
  ordinal: number
}

export const rowToProject = (row: ProjectRow): Project => ({
  id: row.id,
  clientId: row.client_id,
  client: row.client,
  name: row.name,
  active: row.active !== 0,
  ordinal: row.ordinal,
})

export type Settings = {
  preferredStartTime: string
}

// --- reporting. durations are always computed from startedAt and endedAt, and
//  totals are plain sums, so overlapping entries count twice; overlapMinutes says
//  by how much a total is inflated. hours are minutes / 60 rounded to 2 decimals

export type SummaryProject = {
  // blank for entries logged without a project
  project: string
  minutes: number
  hours: number
  entryCount: number
  tickets: string[]
  // non-blank notes, as typed, in start-time order
  notes: string[]
}

export type SummaryClientDay = {
  client: string
  // the catalog's full name, blank when it has none
  name: string
  minutes: number
  hours: number
  entryCount: number
  tickets: string[]
  projects: SummaryProject[]
}

export type SummaryDay = {
  date: string
  minutes: number
  hours: number
  entryCount: number
  // minutes logged more than once that day: the summed durations less the time they cover
  overlapMinutes: number
  clients: SummaryClientDay[]
}

export type SummaryClientTotal = {
  client: string
  name: string
  minutes: number
  hours: number
  entryCount: number
}

export type Summary = {
  from: string
  to: string
  minutes: number
  hours: number
  entryCount: number
  overlapMinutes: number
  clients: SummaryClientTotal[]
  // only the days that have entries, in date order
  days: SummaryDay[]
}

export type WeekDay = {
  date: string
  minutes: number
  hours: number
  entries: Entry[]
}

// a Sunday-to-Saturday week, every day present whether or not it has entries
export type Week = {
  weekStart: string
  weekEnd: string
  minutes: number
  hours: number
  entryCount: number
  overlapMinutes: number
  clients: SummaryClientTotal[]
  days: WeekDay[]
}

// a failure the caller can act on, carried up to the route as an HTTP status
export type RequestError = Error & { status: 400 | 404 | 409 }

export const requestError = (status: RequestError['status'], message: string): RequestError =>
  Object.assign(new Error(message), { status })

export const isRequestError = (err: unknown): err is RequestError =>
  err instanceof Error && typeof (err as Partial<RequestError>).status === 'number'

export const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Error && /UNIQUE constraint failed/.test(err.message)
