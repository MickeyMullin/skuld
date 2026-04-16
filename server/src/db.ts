// server/src/db.ts

import { Database } from 'bun:sqlite'
import { rowToEntry, type Entry, type EntryRow } from './types'

export const db = new Database('skuld.db', { create: true })

// TODO: db.exec deprecated; update to db.run
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    client TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
  CREATE INDEX IF NOT EXISTS idx_entries_client ON entries(client);
`)

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
  client: string
}

export const insertEntry = (params: InsertParams): Entry => {
  const result = db
    .query<{ id: number }, [string, string, string, string, string]>(
      `INSERT INTO entries (date, started_at, ended_at, note, client)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .get(
      params.date,
      params.startedAt,
      params.endedAt,
      params.note,
      params.client,
    )
  if (!result) throw new Error('Insert failed')
  const entry = getEntryById(result.id)
  if (!entry) throw new Error('Entry not found after insert')
  return entry
}

export const updateEntry = (id: number, params: InsertParams): Entry => {
  db.query<
    null,
    [string, string, string, string, string, number]
  >(
    `UPDATE entries
     SET date = ?, started_at = ?, ended_at = ?, note = ?, client = ?
     WHERE id = ?`,
  ).run(
    params.date,
    params.startedAt,
    params.endedAt,
    params.note,
    params.client,
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

export const listClients = (): string[] => {
  const rows = db
    .query<{ client: string }, []>(
      `SELECT DISTINCT client FROM entries ORDER BY client ASC`,
    )
    .all()
  return rows.map((r) => r.client)
}
