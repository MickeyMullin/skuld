// server/src/db.ts

import { Database } from 'bun:sqlite'
import { config } from './config'
import { initSchema } from './schema'
import { rowToEntry, type Entry, type EntryRow } from './types'

export const db = new Database(config.dbPath, { create: true })

initSchema(db)

export const listEntriesInRange = (from: string, to: string): Entry[] => {
  const rows = db
    .query<EntryRow, [string, string]>(
      `SELECT * FROM entries WHERE date >= ? AND date <= ? ORDER BY date, started_at`,
    )
    .all(from, to)
  return rows.map(rowToEntry)
}

export const getEntryById = (id: number): Entry | null => {
  const row = db
    .query<EntryRow, [number]>(`SELECT * FROM entries WHERE id = ?`)
    .get(id)
  return row ? rowToEntry(row) : null
}

export const getEntriesByDate = (date: string): Entry[] => {
  const rows = db
    .query<EntryRow, [string]>(
      `SELECT * FROM entries WHERE date = ? ORDER BY started_at`,
    )
    .all(date)
  return rows.map(rowToEntry)
}

type InsertParams = {
  date: string
  startedAt: string
  endedAt: string
  note: string
  ticket: string
  client: string
  project: string
}

export const insertEntry = (params: InsertParams): Entry => {
  const result = db
    .query<{ id: number }, [string, string, string, string, string, string, string]>(
      `INSERT INTO entries (date, started_at, ended_at, note, ticket, client, project)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .get(
      params.date,
      params.startedAt,
      params.endedAt,
      params.note,
      params.ticket,
      params.client,
      params.project,
    )
  if (!result) throw new Error('Insert failed')
  const entry = getEntryById(result.id)
  if (!entry) throw new Error('Entry not found after insert')
  return entry
}

export const updateEntry = (id: number, params: InsertParams): Entry => {
  db.query<
    null,
    [string, string, string, string, string, string, string, number]
  >(
    `UPDATE entries
     SET date = ?, started_at = ?, ended_at = ?, note = ?, ticket = ?, client = ?, project = ?
     WHERE id = ?`,
  ).run(
    params.date,
    params.startedAt,
    params.endedAt,
    params.note,
    params.ticket,
    params.client,
    params.project,
    id,
  )
  const entry = getEntryById(id)
  if (!entry) throw new Error('Entry not found after update')
  return entry
}

export const deleteEntry = (id: number): boolean => {
  const result = db
    .query<null, [number]>(`DELETE FROM entries WHERE id = ?`)
    .run(id)
  return result.changes > 0
}
