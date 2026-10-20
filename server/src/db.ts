// server/src/db.ts

import { Database } from 'bun:sqlite'
import { config } from './config'
import { initSchema } from './schema'
import { isUniqueViolation, requestError, rowToEntry, type Entry, type EntryRow } from './types'

export const db = new Database(config.dbPath, { create: true })

initSchema(db)

// externalId narrows the range to the entry carrying it, if any
export const listEntriesInRange = (from: string, to: string, externalId?: string): Entry[] => {
  const rows =
    externalId === undefined
      ? db
          .query<EntryRow, [string, string]>(
            `SELECT * FROM entries WHERE date >= ? AND date <= ? ORDER BY date, started_at`,
          )
          .all(from, to)
      : db
          .query<EntryRow, [string, string, string]>(
            `SELECT * FROM entries WHERE date >= ? AND date <= ? AND external_id = ?
             ORDER BY date, started_at`,
          )
          .all(from, to, externalId)
  return rows.map(rowToEntry)
}

export const getEntryById = (id: number): Entry | null => {
  const row = db
    .query<EntryRow, [number]>(`SELECT * FROM entries WHERE id = ?`)
    .get(id)
  return row ? rowToEntry(row) : null
}

export const getEntryByExternalId = (externalId: string): Entry | null => {
  const row = db
    .query<EntryRow, [string]>(`SELECT * FROM entries WHERE external_id = ?`)
    .get(externalId)
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
  externalId?: string | null
}

// a second entry claiming an externalId is the caller's conflict, not a server fault
const claimingExternalId = <T,>(externalId: string | null | undefined, fn: () => T): T => {
  try {
    return fn()
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw requestError(409, `Another entry already has externalId ${externalId}`)
    }
    throw err
  }
}

export const insertEntry = (params: InsertParams): Entry => {
  const result = claimingExternalId(params.externalId, () =>
    db
      .query<
        { id: number },
        [string, string, string, string, string, string, string, string | null]
      >(
        `INSERT INTO entries (date, started_at, ended_at, note, ticket, client, project, external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        params.externalId ?? null,
      ),
  )
  if (!result) throw new Error('Insert failed')
  const entry = getEntryById(result.id)
  if (!entry) throw new Error('Entry not found after insert')
  return entry
}

export const updateEntry = (id: number, params: InsertParams): Entry => {
  claimingExternalId(params.externalId, () =>
    db
      .query<null, [string, string, string, string, string, string, string, string | null, number]>(
        `UPDATE entries
         SET date = ?, started_at = ?, ended_at = ?, note = ?, ticket = ?, client = ?, project = ?,
           external_id = ?
         WHERE id = ?`,
      )
      .run(
        params.date,
        params.startedAt,
        params.endedAt,
        params.note,
        params.ticket,
        params.client,
        params.project,
        params.externalId ?? null,
        id,
      ),
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
