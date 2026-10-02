// server/src/catalog.ts

// clients, projects, and settings: the records the entry form picks from

import { db } from './db'
import {
  requestError,
  rowToClient,
  rowToProject,
  type Client,
  type ClientRow,
  type Project,
  type ProjectRow,
  type Settings,
} from './types'

const CODE_PATTERN = /^[A-Z]{1,3}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const DEFAULT_SETTINGS: Settings = { preferredStartTime: '09:00' }

const normalizeCode = (raw: string): string => {
  const code = raw.trim().toUpperCase()
  if (!CODE_PATTERN.test(code)) throw requestError(400, 'Client code must be 1–3 letters')
  return code
}

const normalizeProjectName = (raw: string): string => {
  const name = raw.trim()
  if (!name) throw requestError(400, 'Project name is required')
  return name
}

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Error && /UNIQUE constraint failed/.test(err.message)

// --- clients

export const listClients = (): Client[] =>
  db
    .query<ClientRow, []>(`SELECT * FROM clients ORDER BY ordinal, code`)
    .all()
    .map(rowToClient)

const getClient = (id: number): Client => {
  const row = db.query<ClientRow, [number]>(`SELECT * FROM clients WHERE id = ?`).get(id)
  if (!row) throw requestError(404, 'Client not found')
  return rowToClient(row)
}

const findClientByCode = (code: string): Client | null => {
  const row = db.query<ClientRow, [string]>(`SELECT * FROM clients WHERE code = ?`).get(code)
  return row ? rowToClient(row) : null
}

type ClientInput = { code: string; name?: string; active?: boolean }

export const createClient = (input: ClientInput): Client => {
  const code = normalizeCode(input.code)
  try {
    const row = db
      .query<ClientRow, [string, string, number]>(
        `INSERT INTO clients (code, name, active, ordinal)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(ordinal), -1) + 1 FROM clients))
         RETURNING *`,
      )
      .get(code, input.name?.trim() ?? '', input.active === false ? 0 : 1)!
    return rowToClient(row)
  } catch (err) {
    if (isUniqueViolation(err)) throw requestError(409, `Client ${code} already exists`)
    throw err
  }
}

// a code change is carried onto every entry filed under the old code, since
//  entries name their client by code
export const updateClient = (id: number, patch: Partial<ClientInput>): Client =>
  db.transaction(() => {
    const existing = getClient(id)
    const code = patch.code === undefined ? existing.code : normalizeCode(patch.code)
    const name = patch.name === undefined ? existing.name : patch.name.trim()
    const active = patch.active ?? existing.active
    try {
      db.query<null, [string, string, number, number]>(
        `UPDATE clients SET code = ?, name = ?, active = ? WHERE id = ?`,
      ).run(code, name, active ? 1 : 0, id)
    } catch (err) {
      if (isUniqueViolation(err)) throw requestError(409, `Client ${code} already exists`)
      throw err
    }
    if (code !== existing.code) {
      db.query<null, [string, string]>(`UPDATE entries SET client = ? WHERE client = ?`).run(
        code,
        existing.code,
      )
    }
    return getClient(id)
  })()

// ids in their new order; any client left out keeps its ordinal
export const reorderClients = (ids: number[]): Client[] => {
  const setOrdinal = db.query<null, [number, number]>(`UPDATE clients SET ordinal = ? WHERE id = ?`)
  db.transaction(() => ids.forEach((id, i) => setOrdinal.run(i, id)))()
  return listClients()
}

// the canonical code for an entry's client, adding it to the catalog when it's
//  new (as typed into the form's "Other…" field). only a new code is held to
//  the code format, so entries under an older, longer code still save
export const ensureClient = (raw: string): string => {
  const code = raw.trim().toUpperCase()
  return (findClientByCode(code) ?? createClient({ code })).code
}

// --- projects

const PROJECT_SELECT = `
  SELECT projects.id, projects.client_id, clients.code AS client, projects.name,
         projects.active, projects.ordinal
  FROM projects JOIN clients ON clients.id = projects.client_id`

export const listProjects = (): Project[] =>
  db
    .query<ProjectRow, []>(
      `${PROJECT_SELECT} ORDER BY clients.ordinal, clients.code, projects.ordinal, projects.id`,
    )
    .all()
    .map(rowToProject)

const getProject = (id: number): Project => {
  const row = db.query<ProjectRow, [number]>(`${PROJECT_SELECT} WHERE projects.id = ?`).get(id)
  if (!row) throw requestError(404, 'Project not found')
  return rowToProject(row)
}

type ProjectInput = { clientId: number; name: string; active?: boolean }

export const createProject = (input: ProjectInput): Project => {
  const client = getClient(input.clientId)
  const name = normalizeProjectName(input.name)
  try {
    const row = db
      .query<{ id: number }, [number, string, number]>(
        `INSERT INTO projects (client_id, name, active, ordinal)
         VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(ordinal), -1) + 1 FROM projects WHERE client_id = ?1))
         RETURNING id`,
      )
      .get(client.id, name, input.active === false ? 0 : 1)!
    return getProject(row.id)
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw requestError(409, `${client.code} already has a project named ${name}`)
    }
    throw err
  }
}

// a rename is carried onto the client's entries, which name their project as text
export const updateProject = (
  id: number,
  patch: Partial<Omit<ProjectInput, 'clientId'>>,
): Project =>
  db.transaction(() => {
    const existing = getProject(id)
    const name = patch.name === undefined ? existing.name : normalizeProjectName(patch.name)
    const active = patch.active ?? existing.active
    try {
      db.query<null, [string, number, number]>(
        `UPDATE projects SET name = ?, active = ? WHERE id = ?`,
      ).run(name, active ? 1 : 0, id)
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw requestError(409, `${existing.client} already has a project named ${name}`)
      }
      throw err
    }
    if (name !== existing.name) {
      db.query<null, [string, string, string]>(
        `UPDATE entries SET project = ? WHERE client = ? AND project = ?`,
      ).run(name, existing.client, existing.name)
    }
    return getProject(id)
  })()

// ids in their new order within one client; a project of another client is ignored
export const reorderProjects = (clientId: number, ids: number[]): Project[] => {
  const setOrdinal = db.query<null, [number, number, number]>(
    `UPDATE projects SET ordinal = ? WHERE id = ? AND client_id = ?`,
  )
  db.transaction(() => ids.forEach((id, i) => setOrdinal.run(i, id, clientId)))()
  return listProjects()
}

// the canonical name for an entry's project under its client, adding it to the
//  catalog when it's new; blank means no project
export const ensureProject = (clientCode: string, raw: string): string => {
  const name = raw.trim()
  if (!name) return ''
  const client = findClientByCode(clientCode)
  if (!client) throw requestError(400, `Unknown client ${clientCode}`)
  const row = db
    .query<{ name: string }, [number, string]>(
      `SELECT name FROM projects WHERE client_id = ? AND name = ? COLLATE NOCASE`,
    )
    .get(client.id, name)
  return row ? row.name : createProject({ clientId: client.id, name }).name
}

// --- settings

export const getSettings = (): Settings => {
  const rows = db.query<{ key: string; value: string }, []>(`SELECT key, value FROM settings`).all()
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...stored }
}

export const updateSettings = (patch: Partial<Settings>): Settings => {
  if (patch.preferredStartTime !== undefined) {
    if (!TIME_PATTERN.test(patch.preferredStartTime)) {
      throw requestError(400, 'Preferred start time must be HH:MM')
    }
    db.query<null, [string, string]>(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    ).run('preferredStartTime', patch.preferredStartTime)
  }
  return getSettings()
}
