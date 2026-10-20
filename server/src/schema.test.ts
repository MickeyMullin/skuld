// server/src/schema.test.ts

import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { initSchema } from './schema'

// a database as it stood before clients and projects were managed records
const legacyDatabase = (rows: { client: string; project: string }[]): Database => {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      client TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.exec(`ALTER TABLE entries ADD COLUMN project TEXT NOT NULL DEFAULT ''`)
  const insert = db.query<null, [string, string]>(
    `INSERT INTO entries (date, started_at, ended_at, client, project)
     VALUES ('2026-08-10', '2026-08-10T13:00:00.000Z', '2026-08-10T14:00:00.000Z', ?, ?)`,
  )
  for (const r of rows) insert.run(r.client, r.project)
  return db
}

const clients = (db: Database) =>
  db.query(`SELECT code, name, active, ordinal FROM clients ORDER BY ordinal`).all()

const projects = (db: Database) =>
  db
    .query(
      `SELECT clients.code AS client, projects.name, projects.ordinal
       FROM projects JOIN clients ON clients.id = projects.client_id
       ORDER BY clients.ordinal, projects.ordinal`,
    )
    .all()

describe('initSchema', () => {
  test('seeds clients from entries alongside the standing ones, ordered by code', () => {
    const db = legacyDatabase([
      { client: 'WB', project: '' },
      { client: 'rs', project: '' },
    ])
    initSchema(db)
    expect(clients(db)).toEqual([
      { code: 'PC', name: 'PortCity Logistics', active: 1, ordinal: 0 },
      { code: 'RS', name: '', active: 1, ordinal: 1 },
      { code: 'WB', name: 'Willow Bridge Properties', active: 1, ordinal: 2 },
    ])
    expect(db.query(`SELECT DISTINCT client FROM entries ORDER BY client`).all()).toEqual([
      { client: 'RS' },
      { client: 'WB' },
    ])
  })

  test('strips the client-name prefix from projects and seeds the project list', () => {
    const db = legacyDatabase([
      { client: 'PC', project: 'PortCity Logistics - Dispatch Intelligence Platform II' },
      { client: 'PC', project: 'Billing' },
      { client: 'WB', project: 'PortCity Logistics - Not PC' },
    ])
    initSchema(db)
    expect(db.query(`SELECT client, project FROM entries ORDER BY id`).all()).toEqual([
      { client: 'PC', project: 'Dispatch Intelligence Platform II' },
      { client: 'PC', project: 'Billing' },
      // only a client's own name is stripped
      { client: 'WB', project: 'PortCity Logistics - Not PC' },
    ])
    expect(projects(db)).toEqual([
      { client: 'PC', name: 'Billing', ordinal: 0 },
      { client: 'PC', name: 'Dispatch Intelligence Platform II', ordinal: 1 },
      { client: 'WB', name: 'PortCity Logistics - Not PC', ordinal: 0 },
    ])
  })

  test('runs each migration once', () => {
    const db = legacyDatabase([{ client: 'PC', project: '' }])
    initSchema(db)
    db.exec(`UPDATE clients SET name = 'Renamed', ordinal = 5 WHERE code = 'PC'`)
    initSchema(db)
    expect(db.query(`SELECT name, ordinal FROM clients WHERE code = 'PC'`).get()).toEqual({
      name: 'Renamed',
      ordinal: 5,
    })
    expect(db.query(`PRAGMA user_version`).get()).toEqual({ user_version: 2 })
  })

  test('creates a fresh database with the standing clients and project', () => {
    const db = new Database(':memory:')
    initSchema(db)
    expect(clients(db).map((c: any) => c.code)).toEqual(['PC', 'WB'])
    expect(projects(db)).toEqual([
      { client: 'PC', name: 'Dispatch Intelligence Platform II', ordinal: 0 },
    ])
  })

  test('adds externalId to a database that already has rows', () => {
    const db = legacyDatabase([
      { client: 'PC', project: '' },
      { client: 'WB', project: '' },
    ])
    // already past the catalog migration, so only the externalId one is left to run
    db.exec(`PRAGMA user_version = 1`)
    initSchema(db)
    expect(db.query(`PRAGMA user_version`).get()).toEqual({ user_version: 2 })
    expect(db.query(`SELECT id, client, external_id FROM entries ORDER BY id`).all()).toEqual([
      { id: 1, client: 'PC', external_id: null },
      { id: 2, client: 'WB', external_id: null },
    ])

    // the index is unique, but only over entries that have one
    const tag = db.query<null, [string | null, number]>(`UPDATE entries SET external_id = ? WHERE id = ?`)
    tag.run('job:1', 1)
    expect(() => tag.run('job:1', 2)).toThrow('UNIQUE constraint failed')
    tag.run(null, 2)
    db.exec(`INSERT INTO entries (date, started_at, ended_at, client) VALUES ('2026-08-10', 'a', 'b', 'PC')`)
    expect(db.query(`SELECT COUNT(*) AS n FROM entries WHERE external_id IS NULL`).get()).toEqual({ n: 2 })
  })

  test('a fresh database gets the externalId column and index', () => {
    const db = new Database(':memory:')
    initSchema(db)
    const columns = db.query<{ name: string }, []>(`PRAGMA table_info(entries)`).all()
    expect(columns.map((c) => c.name)).toContain('external_id')
    const indexes = db.query<{ name: string; unique: number; partial: number }, []>(`PRAGMA index_list(entries)`).all()
    expect(indexes.find((i) => i.name === 'idx_entries_external_id')).toMatchObject({ unique: 1, partial: 1 })
  })
})
