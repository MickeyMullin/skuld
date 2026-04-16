// server/src/types.ts

export type Entry = {
  id: number
  date: string
  startedAt: string
  endedAt: string
  note: string
  client: string
  createdAt: string
}

export type EntryRow = {
  id: number
  date: string
  started_at: string
  ended_at: string
  note: string
  client: string
  created_at: string
}

export type CreateEntryInput = {
  date: string
  startedAt: string
  endedAt: string
  note?: string
  client: string
}

export type UpdateEntryInput = Partial<CreateEntryInput>

export const rowToEntry = (row: EntryRow): Entry => ({
  id: row.id,
  date: row.date,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  note: row.note,
  client: row.client,
  createdAt: row.created_at,
})
