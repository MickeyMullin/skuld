// server/src/entries.test.ts

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// routes write through the shared db module, so point it at a throwaway file
//  before that module is first loaded. the dates here (June 2024) are kept clear
//  of every other test file's, since they can share one database
const dir = mkdtempSync(join(tmpdir(), 'skuld-entries-'))
process.env.SKULD_DB = join(dir, 'test.db')
const { routes } = await import('./routes')

// bun runs every test file in one process and the db module opens only the
//  first file's database, so nothing is removed until all of them are done
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const call = async (method: string, path: string, body?: unknown) => {
  const res = await routes.handle(
    new Request(`http://skuld.test/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  return { status: res.status, body: (await res.json()) as any }
}

const DATE = '2024-06-03'

const entry = (overrides: Record<string, unknown> = {}) => ({
  date: DATE,
  startedAt: `${DATE}T14:07:00.000Z`,
  endedAt: `${DATE}T15:22:00.000Z`,
  client: 'PC',
  note: 'First pass',
  ticket: 'RES-9',
  ...overrides,
})

const dayEntries = async () => (await call('GET', `/entries?from=${DATE}&to=${DATE}`)).body

describe('POST /api/entries with externalId', () => {
  test('the first post inserts, with rounding applied', async () => {
    const { status, body } = await call('POST', '/entries', entry({ externalId: 'job:2024-06-03:1' }))
    expect(status).toBe(200)
    expect(body).toMatchObject({
      startedAt: `${DATE}T14:00:00.000Z`,
      endedAt: `${DATE}T15:30:00.000Z`,
      note: 'First pass',
      externalId: 'job:2024-06-03:1',
    })
  })

  test('a repeat updates that entry in place', async () => {
    const [before] = await dayEntries()
    const { status, body } = await call(
      'POST',
      '/entries',
      entry({ externalId: 'job:2024-06-03:1', note: 'Second pass', endedAt: `${DATE}T15:31:00.000Z` }),
    )
    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: before.id,
      note: 'Second pass',
      endedAt: `${DATE}T15:45:00.000Z`,
      createdAt: before.createdAt,
    })
    expect(await dayEntries()).toHaveLength(1)
  })

  test('a repeat is validated like any post', async () => {
    const { status } = await call(
      'POST',
      '/entries',
      entry({ externalId: 'job:2024-06-03:1', endedAt: `${DATE}T14:00:00.000Z` }),
    )
    expect(status).toBe(400)
    expect((await dayEntries())[0].note).toBe('Second pass')
  })

  test('an unusable date or timestamp is a 400, not a server error', async () => {
    expect(await call('POST', '/entries', entry({ date: '6/3/2024' }))).toEqual({
      status: 400,
      body: { error: 'date must be a YYYY-MM-DD date' },
    })
    expect(await call('POST', '/entries', entry({ startedAt: '9:00' }))).toEqual({
      status: 400,
      body: { error: 'startedAt must be an ISO 8601 timestamp' },
    })
  })

  test('a different externalId inserts', async () => {
    const { body } = await call('POST', '/entries', entry({ externalId: 'job:2024-06-03:2' }))
    expect(body.externalId).toBe('job:2024-06-03:2')
    expect(await dayEntries()).toHaveLength(2)
  })

  test('without one, or with a blank one, every post inserts', async () => {
    const a = await call('POST', '/entries', entry())
    const b = await call('POST', '/entries', entry())
    const c = await call('POST', '/entries', entry({ externalId: '  ' }))
    expect(new Set([a.body.id, b.body.id, c.body.id]).size).toBe(3)
    expect([a.body.externalId, b.body.externalId, c.body.externalId]).toEqual([null, null, null])
    expect(await dayEntries()).toHaveLength(5)
  })

  test('GET can narrow a range to one externalId', async () => {
    const { body } = await call('GET', `/entries?from=${DATE}&to=${DATE}&externalId=job:2024-06-03:2`)
    expect(body.map((e: any) => e.externalId)).toEqual(['job:2024-06-03:2'])
    const { body: none } = await call('GET', `/entries?from=${DATE}&to=${DATE}&externalId=missing`)
    expect(none).toEqual([])
  })
})

describe('PUT /api/entries/:id with externalId', () => {
  test('sets, keeps, and clears one', async () => {
    const created = (await call('POST', '/entries', entry())).body
    const set = await call('PUT', `/entries/${created.id}`, { externalId: 'job:put' })
    expect(set.body.externalId).toBe('job:put')
    const kept = await call('PUT', `/entries/${created.id}`, { note: 'Renamed' })
    expect(kept.body).toMatchObject({ note: 'Renamed', externalId: 'job:put' })
    const cleared = await call('PUT', `/entries/${created.id}`, { externalId: null })
    expect(cleared.body.externalId).toBeNull()
  })

  test('claiming another entry\'s externalId is a 409', async () => {
    const created = (await call('POST', '/entries', entry())).body
    const { status, body } = await call('PUT', `/entries/${created.id}`, { externalId: 'job:2024-06-03:1' })
    expect(status).toBe(409)
    expect(body).toEqual({ error: 'Another entry already has externalId job:2024-06-03:1' })
  })
})
