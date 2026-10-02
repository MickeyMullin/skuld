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
    expect(db.query(`PRAGMA user_version`).get()).toEqual({ user_version: 1 })
  })

  test('creates a fresh database with the standing clients and project', () => {
    const db = new Database(':memory:')
    initSchema(db)
    expect(clients(db).map((c: any) => c.code)).toEqual(['PC', 'WB'])
    expect(projects(db)).toEqual([
      { client: 'PC', name: 'Dispatch Intelligence Platform II', ordinal: 0 },
    ])
  })
})
