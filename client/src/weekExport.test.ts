// client/src/weekExport.test.ts

import { describe, expect, test } from 'bun:test'
import type { Client, Entry } from './api'
import { startOfWeek, weekDays } from './dates'
import { buildWeekExport, compactHours, exportDateLabel, weekExportText } from './weekExport'

const clients: Client[] = [
  { id: 1, code: 'PC', name: 'PortCity Logistics', active: true, ordinal: 0 },
  { id: 2, code: 'RS', name: '', active: true, ordinal: 1 },
  { id: 3, code: 'WB', name: 'Willow Bridge Properties', active: true, ordinal: 2 },
]

let nextId = 1
const entry = (
  date: string,
  start: string,
  end: string,
  client: string,
  note: string,
  ticket = '',
  project = '',
): Entry => ({
  id: nextId++,
  date,
  startedAt: new Date(`${date}T${start}:00`).toISOString(),
  endedAt: new Date(`${date}T${end}:00`).toISOString(),
  note,
  ticket,
  client,
  project,
  createdAt: '',
})

const days = weekDays(startOfWeek(new Date(2026, 7, 10)))

describe('exportDateLabel', () => {
  test('formats as the spreadsheet does', () => {
    expect(exportDateLabel(new Date(2026, 7, 9))).toBe('Sun, 8/9/2026')
  })
})

describe('compactHours', () => {
  test('trims trailing zeros', () => {
    expect([90, 180, 105, 15].map(compactHours)).toEqual(['1.5', '3', '1.75', '0.25'])
  })
})

describe('weekExportText', () => {
  test('lists all seven days, clients in configured order, blank days padded', () => {
    const entries = [
      // logged out of order, to show client order comes from the catalog
      entry('2026-08-10', '10:00', '17:45', 'WB', 'Property Budget'),
      entry('2026-08-10', '09:00', '09:15', 'WB', 'Standup'),
      entry('2026-08-10', '08:00', '08:15', 'PC', 'Standup', '', 'Dispatch Intelligence Platform'),
      entry(
        '2026-08-10',
        '08:15',
        '09:45',
        'PC',
        'Document upload fix',
        'RES-158, RES-159',
        'Dispatch Intelligence Platform',
      ),
      entry('2026-08-12', '09:00', '10:30', 'RS', 'Planning'),
    ]
    const lines = weekExportText(buildWeekExport(days, entries, clients)).split('\n')
    expect(lines).toEqual([
      'Sun, 8/9/2026\t\t\t\t\t\t',
      'Mon, 8/10/2026\t1.75\tStandup, Document upload fix\t\t\tRES-158, RES-159\tPortCity Logistics - Dispatch Intelligence Platform',
      'Mon, 8/10/2026\t8\tStandup, Property Budget\t\t\t\tWillow Bridge Properties',
      'Tue, 8/11/2026\t\t\t\t\t\t',
      // no client name falls back to the code
      'Wed, 8/12/2026\t1.5\tPlanning\t\t\t\tRS',
      'Thu, 8/13/2026\t\t\t\t\t\t',
      'Fri, 8/14/2026\t\t\t\t\t\t',
      'Sat, 8/15/2026\t\t\t\t\t\t',
    ])
  })
})
