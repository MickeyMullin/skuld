// server/src/summary.ts

// read-only rollups for reporting: day, client, and project totals over a range,
//  and whole prior weeks of entries

import { listClients, listProjects } from './catalog'
import { addDaysToKey, isDateKey, startOfWeekKey, todayKey } from './dateKeys'
import { listEntriesInRange } from './db'
import { buildTicketList } from './tickets'
import {
  requestError,
  type Client,
  type Entry,
  type Project,
  type Summary,
  type SummaryClientDay,
  type SummaryClientTotal,
  type SummaryDay,
  type SummaryProject,
  type Week,
} from './types'

const MAX_WEEKS = 12
const DEFAULT_WEEKS = 2

export const entryMinutes = (e: Entry): number =>
  (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 60000

export const toHours = (minutes: number): number => Math.round((minutes / 60) * 100) / 100

const sumMinutes = (entries: Entry[]): number =>
  entries.reduce((sum, e) => sum + entryMinutes(e), 0)

// how far the summed durations exceed the time the entries actually cover, i.e.
//  the double-booked minutes. the day view's overlap markers measure each entry
//  against the furthest end before it, which can exceed the entry's own length,
//  so they don't add up to this
export const overlapMinutes = (entries: Entry[]): number => {
  const spans = entries
    .map((e) => [new Date(e.startedAt).getTime(), new Date(e.endedAt).getTime()])
    .sort((a, b) => a[0] - b[0])
  let covered = 0
  let run: number[] | null = null
  for (const [start, end] of spans) {
    if (!run || start > run[1]) {
      if (run) covered += run[1] - run[0]
      run = [start, end]
    } else if (end > run[1]) {
      run[1] = end
    }
  }
  if (run) covered += run[1] - run[0]
  return sumMinutes(entries) - covered / 60000
}

// group preserving first-seen order; callers sort the groups themselves
const groupBy = (entries: Entry[], key: (e: Entry) => string): Map<string, Entry[]> => {
  const out = new Map<string, Entry[]>()
  for (const e of entries) {
    const k = key(e)
    const group = out.get(k)
    if (group) group.push(e)
    else out.set(k, [e])
  }
  return out
}

// clients in configured order, ones the catalog lacks after them by code
const clientOrder = (clients: Client[]) => {
  const rank = new Map(clients.map((c, i) => [c.code, i]))
  return (a: string, b: string): number =>
    (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity) || a.localeCompare(b)
}

// a client's projects in configured order, no-project first, unknown names last
const projectOrder = (client: string, projects: Project[]) => {
  const rank = new Map(
    projects.filter((p) => p.client === client).map((p) => [p.name.toLowerCase(), p.ordinal]),
  )
  const rankOf = (name: string): number => (name === '' ? -1 : (rank.get(name.toLowerCase()) ?? Infinity))
  return (a: string, b: string): number => rankOf(a) - rankOf(b) || a.localeCompare(b)
}

const byStart = (a: Entry, b: Entry): number => a.startedAt.localeCompare(b.startedAt)

const summarizeProject = (project: string, entries: Entry[]): SummaryProject => {
  const minutes = sumMinutes(entries)
  return {
    project,
    minutes,
    hours: toHours(minutes),
    entryCount: entries.length,
    tickets: buildTicketList(entries.map((e) => e.ticket)),
    notes: entries.map((e) => e.note.trim()).filter(Boolean),
  }
}

const summarizeDay = (
  date: string,
  entries: Entry[],
  clients: Client[],
  projects: Project[],
): SummaryDay => {
  const names = new Map(clients.map((c) => [c.code, c.name]))
  const sorted = [...entries].sort(byStart)
  const byClient = groupBy(sorted, (e) => e.client)
  const clientDays: SummaryClientDay[] = [...byClient.keys()]
    .sort(clientOrder(clients))
    .map((client) => {
      const clientEntries = byClient.get(client)!
      const byProject = groupBy(clientEntries, (e) => e.project)
      const minutes = sumMinutes(clientEntries)
      return {
        client,
        name: names.get(client) ?? '',
        minutes,
        hours: toHours(minutes),
        entryCount: clientEntries.length,
        tickets: buildTicketList(clientEntries.map((e) => e.ticket)),
        projects: [...byProject.keys()]
          .sort(projectOrder(client, projects))
          .map((project) => summarizeProject(project, byProject.get(project)!)),
      }
    })
  const minutes = sumMinutes(entries)
  return {
    date,
    minutes,
    hours: toHours(minutes),
    entryCount: entries.length,
    overlapMinutes: overlapMinutes(entries),
    clients: clientDays,
  }
}

// totals for entries already fetched, so a caller holding a wider range (the
//  weeks endpoint) can summarize slices of it without querying again
export const summarizeEntries = (
  from: string,
  to: string,
  entries: Entry[],
  clients: Client[],
  projects: Project[],
): Summary => {
  const byDate = groupBy(entries, (e) => e.date)
  const days = [...byDate.keys()]
    .sort()
    .map((date) => summarizeDay(date, byDate.get(date)!, clients, projects))
  const names = new Map(clients.map((c) => [c.code, c.name]))
  const byClient = groupBy(entries, (e) => e.client)
  const clientTotals: SummaryClientTotal[] = [...byClient.keys()]
    .sort(clientOrder(clients))
    .map((client) => {
      const minutes = sumMinutes(byClient.get(client)!)
      return {
        client,
        name: names.get(client) ?? '',
        minutes,
        hours: toHours(minutes),
        entryCount: byClient.get(client)!.length,
      }
    })
  const minutes = sumMinutes(entries)
  return {
    from,
    to,
    minutes,
    hours: toHours(minutes),
    entryCount: entries.length,
    // overlaps only count within a day, matching the day view
    overlapMinutes: days.reduce((sum, d) => sum + d.overlapMinutes, 0),
    clients: clientTotals,
    days,
  }
}

const requireDateKey = (name: string, value: string): void => {
  if (!isDateKey(value)) throw requestError(400, `${name} must be a YYYY-MM-DD date`)
}

export const getSummary = (from: string, to: string): Summary => {
  requireDateKey('from', from)
  requireDateKey('to', to)
  if (from > to) throw requestError(400, 'from must not be after to')
  return summarizeEntries(from, to, listEntriesInRange(from, to), listClients(), listProjects())
}

type WeeksQuery = { count?: string; before?: string; includeCurrent?: string }

const parseCount = (raw: string | undefined): number => {
  if (raw === undefined) return DEFAULT_WEEKS
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw requestError(400, 'count must be a positive integer')
  }
  return Math.min(Number(raw), MAX_WEEKS)
}

const parseFlag = (name: string, raw: string | undefined): boolean => {
  if (raw === undefined || raw === 'false') return false
  if (raw === 'true') return true
  throw requestError(400, `${name} must be true or false`)
}

// the complete weeks before the one containing `before` (default today), oldest
//  first, optionally followed by that in-progress week itself
export const getWeeks = (query: WeeksQuery, today: string = todayKey()): Week[] => {
  const count = parseCount(query.count)
  const before = query.before ?? today
  requireDateKey('before', before)
  const includeCurrent = parseFlag('includeCurrent', query.includeCurrent)

  const currentStart = startOfWeekKey(before)
  const starts = Array.from({ length: count }, (_, i) => addDaysToKey(currentStart, (i - count) * 7))
  if (includeCurrent) starts.push(currentStart)

  const entries = listEntriesInRange(starts[0], addDaysToKey(starts[starts.length - 1], 6))
  const clients = listClients()
  const projects = listProjects()
  const byDate = groupBy(entries, (e) => e.date)

  return starts.map((weekStart) => {
    const weekEnd = addDaysToKey(weekStart, 6)
    const dates = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i))
    const weekEntries = dates.flatMap((date) => byDate.get(date) ?? [])
    const summary = summarizeEntries(weekStart, weekEnd, weekEntries, clients, projects)
    const dayTotals = new Map(summary.days.map((d) => [d.date, d]))
    return {
      weekStart,
      weekEnd,
      minutes: summary.minutes,
      hours: summary.hours,
      entryCount: summary.entryCount,
      overlapMinutes: summary.overlapMinutes,
      clients: summary.clients,
      days: dates.map((date) => ({
        date,
        minutes: dayTotals.get(date)?.minutes ?? 0,
        hours: dayTotals.get(date)?.hours ?? 0,
        entries: byDate.get(date) ?? [],
      })),
    }
  })
}
