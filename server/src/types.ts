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
}

export type UpdateEntryInput = Partial<CreateEntryInput>

export const rowToEntry = (row: EntryRow): Entry => ({
  id: row.id,
  date: row.date,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  note: row.note,
  ticket: row.ticket,
  client: row.client,
  project: row.project,
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

// a failure the caller can act on, carried up to the route as an HTTP status
export type RequestError = Error & { status: 400 | 404 | 409 }

export const requestError = (status: RequestError['status'], message: string): RequestError =>
  Object.assign(new Error(message), { status })

export const isRequestError = (err: unknown): err is RequestError =>
  err instanceof Error && typeof (err as Partial<RequestError>).status === 'number'
