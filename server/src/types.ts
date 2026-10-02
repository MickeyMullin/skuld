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

// a project belongs to one client; the same name under two clients is two projects
export type ClientProject = {
  client: string
  project: string
}
