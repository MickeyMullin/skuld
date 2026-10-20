// server/src/summary.test.ts

import { beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// routes write through the shared db module, so point it at a throwaway file
//  before that module is first loaded. the dates here (March 2025) are kept clear
//  of every other test file's, since they can share one database
const dir = mkdtempSync(join(tmpdir(), 'skuld-summary-'))
process.env.SKULD_DB = join(dir, 'test.db')
const { routes } = await import('./routes')
const { listClients, listProjects } = await import('./catalog')
const { addDaysToKey, startOfWeekKey, todayKey } = await import('./dateKeys')
const { getWeeks, overlapMinutes } = await import('./summary')

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

const DIP = 'Dispatch Intelligence Platform II'

const post = (
  date: string,
  start: string,
  end: string,
  client: string,
  project: string,
  note: string,
  ticket = '',
) =>
  call('POST', '/entries', {
    date,
    startedAt: `${date}T${start}:00.000Z`,
    endedAt: `${date}T${end}:00.000Z`,
    client,
    project,
    note,
    ticket,
  })

// in configured order, since other test files may have reordered the catalog
const ordered = (codes: string[]): string[] =>
  listClients()
    .map((c) => c.code)
    .filter((c) => codes.includes(c))

beforeAll(async () => {
  // Monday: three PC entries over two projects, and a WB one overlapping the last hour
  await post('2025-03-03', '14:00', '15:00', 'PC', DIP, 'Standup')
  await post('2025-03-03', '15:00', '16:30', 'PC', DIP, 'Cache fix', 'RES-1, RES-2')
  await post('2025-03-03', '16:30', '17:00', 'PC', 'Billing', 'Invoices', 'res-2,RES-3')
  await post('2025-03-03', '16:00', '17:00', 'WB', '', 'Nav')
  // Wednesday, after an empty Tuesday
  await post('2025-03-05', '14:00', '16:15', 'WB', '', 'Review', '42')
  // the Saturday closing that week and the Sunday opening the next
  await post('2025-03-08', '14:00', '15:00', 'WB', '', 'Saturday')
  await post('2025-03-09', '14:00', '15:00', 'PC', DIP, 'Sunday')
})

describe('overlapMinutes', () => {
  const span = (start: string, end: string) => ({
    startedAt: `2025-01-01T${start}:00.000Z`,
    endedAt: `2025-01-01T${end}:00.000Z`,
  })
  const of = (...spans: { startedAt: string; endedAt: string }[]) =>
    overlapMinutes(spans.map((s, id) => ({ ...s, id }) as any))

  test('is the summed time less the time covered', () => {
    expect(of()).toBe(0)
    expect(of(span('09:00', '10:00'), span('10:00', '11:00'))).toBe(0)
    expect(of(span('09:00', '10:00'), span('09:30', '10:30'))).toBe(30)
    // one entry swallowing two others counts both
    expect(of(span('09:00', '12:00'), span('10:00', '11:00'), span('10:30', '11:30'))).toBe(120)
  })
})

describe('GET /api/summary', () => {
  test('breaks a multi-day range down by day, client, and project', async () => {
    const { status, body } = await call('GET', '/summary?from=2025-03-03&to=2025-03-05')
    expect(status).toBe(200)
    expect(body).toMatchObject({
      from: '2025-03-03',
      to: '2025-03-05',
      minutes: 375,
      hours: 6.25,
      entryCount: 5,
      overlapMinutes: 60,
    })
    expect(body.clients.map((c: any) => c.client)).toEqual(ordered(['PC', 'WB']))
    expect(body.clients.find((c: any) => c.client === 'PC')).toEqual({
      client: 'PC',
      name: 'PortCity Logistics',
      minutes: 180,
      hours: 3,
      entryCount: 3,
    })
    expect(body.clients.find((c: any) => c.client === 'WB')).toMatchObject({ minutes: 195, hours: 3.25 })

    // the empty Tuesday is left out
    expect(body.days.map((d: any) => d.date)).toEqual(['2025-03-03', '2025-03-05'])
    const [monday, wednesday] = body.days
    expect(monday).toMatchObject({ minutes: 240, hours: 4, entryCount: 4, overlapMinutes: 60 })
    expect(wednesday).toMatchObject({ minutes: 135, hours: 2.25, entryCount: 1, overlapMinutes: 0 })

    const pc = monday.clients.find((c: any) => c.client === 'PC')
    // multi-ticket fields are split and deduped case-insensitively across the client's day
    expect(pc).toMatchObject({ minutes: 180, entryCount: 3, tickets: ['RES-1', 'RES-2', 'RES-3'] })
    const projectRank = new Map(
      listProjects()
        .filter((p) => p.client === 'PC')
        .map((p) => [p.name, p.ordinal]),
    )
    const expectedProjects = [DIP, 'Billing'].sort((a, b) => projectRank.get(a)! - projectRank.get(b)!)
    expect(pc.projects.map((p: any) => p.project)).toEqual(expectedProjects)
    expect(pc.projects.find((p: any) => p.project === DIP)).toEqual({
      project: DIP,
      minutes: 150,
      hours: 2.5,
      entryCount: 2,
      tickets: ['RES-1', 'RES-2'],
      notes: ['Standup', 'Cache fix'],
    })
    expect(pc.projects.find((p: any) => p.project === 'Billing')).toMatchObject({
      minutes: 30,
      hours: 0.5,
      tickets: ['res-2', 'RES-3'],
      notes: ['Invoices'],
    })

    expect(monday.clients.find((c: any) => c.client === 'WB')).toEqual({
      client: 'WB',
      name: 'Willow Bridge Properties',
      minutes: 60,
      hours: 1,
      entryCount: 1,
      tickets: [],
      projects: [{ project: '', minutes: 60, hours: 1, entryCount: 1, tickets: [], notes: ['Nav'] }],
    })
  })

  test('an empty range totals zero', async () => {
    const { status, body } = await call('GET', '/summary?from=2025-03-04&to=2025-03-04')
    expect(status).toBe(200)
    expect(body).toEqual({
      from: '2025-03-04',
      to: '2025-03-04',
      minutes: 0,
      hours: 0,
      entryCount: 0,
      overlapMinutes: 0,
      clients: [],
      days: [],
    })
  })

  test('rejects malformed and reversed ranges', async () => {
    expect(await call('GET', '/summary?from=2025-3-3&to=2025-03-05')).toEqual({
      status: 400,
      body: { error: 'from must be a YYYY-MM-DD date' },
    })
    expect((await call('GET', '/summary?from=2025-03-03&to=2025-02-30')).status).toBe(400)
    expect(await call('GET', '/summary?from=2025-03-05&to=2025-03-03')).toEqual({
      status: 400,
      body: { error: 'from must not be after to' },
    })
  })
})

describe('GET /api/weeks', () => {
  test('defaults to the two complete weeks before the current one', async () => {
    const { status, body } = await call('GET', '/weeks')
    expect(status).toBe(200)
    const current = startOfWeekKey(todayKey())
    expect(body.map((w: any) => w.weekStart)).toEqual([
      addDaysToKey(current, -14),
      addDaysToKey(current, -7),
    ])
    expect(body[1].weekEnd).toBe(addDaysToKey(current, -1))
  })

  test('returns whole weeks before the given date, empty days included', async () => {
    const { status, body } = await call('GET', '/weeks?before=2025-03-12')
    expect(status).toBe(200)
    expect(body.map((w: any) => [w.weekStart, w.weekEnd])).toEqual([
      ['2025-02-23', '2025-03-01'],
      ['2025-03-02', '2025-03-08'],
    ])

    const [empty, week] = body
    expect(empty).toMatchObject({ minutes: 0, hours: 0, entryCount: 0, overlapMinutes: 0, clients: [] })
    expect(empty.days).toHaveLength(7)
    expect(empty.days.every((d: any) => d.entries.length === 0 && d.minutes === 0)).toBe(true)

    expect(week).toMatchObject({ minutes: 435, hours: 7.25, entryCount: 6, overlapMinutes: 60 })
    expect(week.days.map((d: any) => d.date)).toEqual([
      '2025-03-02',
      '2025-03-03',
      '2025-03-04',
      '2025-03-05',
      '2025-03-06',
      '2025-03-07',
      '2025-03-08',
    ])
    expect(week.days.map((d: any) => d.entries.length)).toEqual([0, 4, 0, 1, 0, 0, 1])
    expect(week.days[1]).toMatchObject({ minutes: 240, hours: 4 })
    // full entries, in start order
    expect(week.days[1].entries.map((e: any) => e.note)).toEqual([
      'Standup',
      'Cache fix',
      'Nav',
      'Invoices',
    ])
    expect(week.days[1].entries[0]).toMatchObject({
      date: '2025-03-03',
      client: 'PC',
      project: DIP,
      externalId: null,
    })
    // Saturday closes its week; the Sunday after belongs to the next
    expect(week.days[6].entries.map((e: any) => e.note)).toEqual(['Saturday'])
    expect(body.flatMap((w: any) => w.days.flatMap((d: any) => d.entries.map((e: any) => e.note)))).not.toContain(
      'Sunday',
    )
  })

  test('count and before pick the window, and a Sunday is its own week\'s start', async () => {
    const { body } = await call('GET', '/weeks?count=1&before=2025-03-09')
    expect(body.map((w: any) => w.weekStart)).toEqual(['2025-03-02'])
    const { body: saturday } = await call('GET', '/weeks?count=1&before=2025-03-08')
    expect(saturday.map((w: any) => w.weekStart)).toEqual(['2025-02-23'])
  })

  test('includeCurrent appends the in-progress week', async () => {
    const { body } = await call('GET', '/weeks?count=1&before=2025-03-12&includeCurrent=true')
    expect(body.map((w: any) => w.weekStart)).toEqual(['2025-03-02', '2025-03-09'])
    expect(body[1].days[0].entries.map((e: any) => e.note)).toEqual(['Sunday'])
    expect(body[1]).toMatchObject({ minutes: 60, hours: 1, entryCount: 1 })
    expect(body[1].clients).toEqual([
      { client: 'PC', name: 'PortCity Logistics', minutes: 60, hours: 1, entryCount: 1 },
    ])
  })

  test('caps count at 12', () => {
    const weeks = getWeeks({ count: '50' }, '2025-03-12')
    expect(weeks).toHaveLength(12)
    expect(weeks[11].weekStart).toBe('2025-03-02')
  })

  test('rejects a bad count, before, or includeCurrent', async () => {
    for (const count of ['0', '-1', '1.5', 'two', '']) {
      expect(await call('GET', `/weeks?count=${count}`)).toEqual({
        status: 400,
        body: { error: 'count must be a positive integer' },
      })
    }
    expect(await call('GET', '/weeks?before=03/12/2025')).toEqual({
      status: 400,
      body: { error: 'before must be a YYYY-MM-DD date' },
    })
    expect((await call('GET', '/weeks?includeCurrent=yes')).status).toBe(400)
  })
})
