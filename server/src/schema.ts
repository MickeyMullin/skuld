// server/src/schema.ts

import type { Database } from 'bun:sqlite'

// clients standing before any entries existed for them, with the full names the
//  copy/export output uses
const STANDING_CLIENTS = [
  { code: 'PC', name: 'PortCity Logistics' },
  { code: 'WB', name: 'Willow Bridge Properties' },
]

// standing projects, offered even before any entry uses them
const STANDING_PROJECTS = [{ client: 'PC', name: 'Dispatch Intelligence Platform II' }]

const createTables = (db: Database): void => {
  // TODO: db.exec deprecated; update to db.run
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      ticket TEXT NOT NULL DEFAULT '',
      client TEXT NOT NULL,
      project TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS idx_entries_client ON entries(client);

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      ordinal INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      ordinal INTEGER NOT NULL DEFAULT 0,
      UNIQUE (client_id, name COLLATE NOCASE)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // backfill columns on databases created before they existed
  const columns = db.query<{ name: string }, []>(`PRAGMA table_info(entries)`).all()
  if (!columns.some((c) => c.name === 'ticket')) {
    db.exec(`ALTER TABLE entries ADD COLUMN ticket TEXT NOT NULL DEFAULT ''`)
  }
  if (!columns.some((c) => c.name === 'project')) {
    db.exec(`ALTER TABLE entries ADD COLUMN project TEXT NOT NULL DEFAULT ''`)
  }
}

// v1: clients and projects become managed records instead of being derived from
//  entries. seeds both from what entries already use, then drops the client-name
//  prefix projects used to carry, now that the export joins the two itself
const migrateToCatalog = (db: Database): void => {
  const insertClient = db.query<null, [string, string]>(
    `INSERT OR IGNORE INTO clients (code, name) VALUES (?, ?)`,
  )
  for (const c of STANDING_CLIENTS) insertClient.run(c.code, c.name)
  db.exec(`
    INSERT OR IGNORE INTO clients (code)
      SELECT DISTINCT UPPER(TRIM(client)) FROM entries WHERE TRIM(client) != '';
    UPDATE clients SET ordinal = (
      SELECT COUNT(*) FROM clients AS earlier WHERE earlier.code < clients.code
    );
  `)

  // entries stored their client as typed; the catalog's code is canonical
  db.exec(`
    UPDATE entries SET client = (SELECT code FROM clients WHERE code = TRIM(entries.client))
    WHERE TRIM(client) != '';
  `)

  const named = db
    .query<{ code: string; name: string }, []>(`SELECT code, name FROM clients WHERE name != ''`)
    .all()
  // substr rather than LIKE, so a name holding % or _ still matches literally
  const stripPrefix = db.query<null, [string, string]>(
    `UPDATE entries SET project = substr(project, length(?2) + 1)
     WHERE client = ?1 AND substr(project, 1, length(?2)) = ?2 AND length(project) > length(?2)`,
  )
  for (const c of named) stripPrefix.run(c.code, `${c.name} - `)

  const insertProject = db.query<null, [string, string]>(
    `INSERT OR IGNORE INTO projects (client_id, name)
     SELECT id, ? FROM clients WHERE code = ?`,
  )
  for (const p of STANDING_PROJECTS) insertProject.run(p.name, p.client)
  db.exec(`
    INSERT OR IGNORE INTO projects (client_id, name)
      SELECT DISTINCT clients.id, TRIM(entries.project)
      FROM entries JOIN clients ON clients.code = entries.client
      WHERE TRIM(entries.project) != '';
    UPDATE projects SET ordinal = (
      SELECT COUNT(*) FROM projects AS earlier
      WHERE earlier.client_id = projects.client_id
        AND LOWER(earlier.name) < LOWER(projects.name)
    );
  `)
}

// ordered schema migrations, tracked in PRAGMA user_version; each runs once
const MIGRATIONS = [migrateToCatalog]

export const initSchema = (db: Database): void => {
  createTables(db)
  const { user_version: version } = db
    .query<{ user_version: number }, []>(`PRAGMA user_version`)
    .get()!
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      MIGRATIONS[v](db)
      db.exec(`PRAGMA user_version = ${v + 1}`)
    })()
  }
}
