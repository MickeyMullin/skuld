// server/src/catalog.test.ts

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// the catalog writes through the shared db module, so point it at a throwaway
//  file before that module is first loaded
const dir = mkdtempSync(join(tmpdir(), 'skuld-catalog-'))
process.env.SKULD_DB = join(dir, 'test.db')
const catalog = await import('./catalog')
const { insertEntry, getEntryById } = await import('./db')

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const entry = (client: string, project: string) =>
  insertEntry({
    date: '2026-08-10',
    startedAt: '2026-08-10T13:00:00.000Z',
    endedAt: '2026-08-10T14:00:00.000Z',
    note: '',
    ticket: '',
    client,
    project,
  })

describe('clients', () => {
  test('a new client is validated and appended after the rest', () => {
    expect(() => catalog.createClient({ code: 'ABCD' })).toThrow('1–3 letters')
    expect(() => catalog.createClient({ code: 'pc' })).toThrow('already exists')
    const rs = catalog.createClient({ code: ' rs ', name: 'Resultstack ' })
    expect(rs).toMatchObject({ code: 'RS', name: 'Resultstack', active: true, ordinal: 2 })
  })

  test('renaming a code carries onto its entries', () => {
    const created = catalog.createClient({ code: 'OLD' })
    const e = entry('OLD', '')
    catalog.updateClient(created.id, { code: 'new', active: false })
    expect(getEntryById(e.id)?.client).toBe('NEW')
    expect(catalog.listClients().find((c) => c.id === created.id)).toMatchObject({
      code: 'NEW',
      active: false,
    })
  })

  test('reordering rewrites ordinals', () => {
    const ids = catalog.listClients().map((c) => c.id).reverse()
    expect(catalog.reorderClients(ids).map((c) => c.id)).toEqual(ids)
  })

  test('ensureClient reuses an existing code and adds a new one', () => {
    expect(catalog.ensureClient('wb')).toBe('WB')
    expect(catalog.ensureClient('zz')).toBe('ZZ')
    expect(() => catalog.ensureClient('TOOLONG')).toThrow('1–3 letters')
  })
})

describe('projects', () => {
  let pcId: number
  beforeAll(() => {
    pcId = catalog.listClients().find((c) => c.code === 'PC')!.id
  })

  test('a rename carries onto that client\'s entries only', () => {
    const p = catalog.createProject({ clientId: pcId, name: 'Alpha' })
    const pcEntry = entry('PC', 'Alpha')
    const wbEntry = entry('WB', 'Alpha')
    catalog.updateProject(p.id, { name: 'Beta' })
    expect(getEntryById(pcEntry.id)?.project).toBe('Beta')
    expect(getEntryById(wbEntry.id)?.project).toBe('Alpha')
    expect(() => catalog.updateProject(p.id, { name: 'dispatch intelligence platform ii' })).toThrow(
      'already has a project',
    )
  })

  test('ensureProject matches case-insensitively and adds new names', () => {
    expect(catalog.ensureProject('PC', 'beta')).toBe('Beta')
    expect(catalog.ensureProject('PC', '')).toBe('')
    expect(catalog.ensureProject('WB', 'Gamma')).toBe('Gamma')
    expect(catalog.listProjects().filter((p) => p.client === 'WB').map((p) => p.name)).toContain(
      'Gamma',
    )
  })

  test('reordering only touches the given client', () => {
    const pc = catalog.listProjects().filter((p) => p.client === 'PC')
    const reversed = pc.map((p) => p.id).reverse()
    const after = catalog.reorderProjects(pcId, reversed).filter((p) => p.client === 'PC')
    expect(after.map((p) => p.id)).toEqual(reversed)
  })
})

describe('settings', () => {
  test('preferred start time defaults to 09:00 and validates', () => {
    expect(catalog.getSettings()).toEqual({ preferredStartTime: '09:00' })
    expect(catalog.updateSettings({ preferredStartTime: '08:30' })).toEqual({
      preferredStartTime: '08:30',
    })
    expect(() => catalog.updateSettings({ preferredStartTime: '25:00' })).toThrow('HH:MM')
  })
})
