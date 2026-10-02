// client/src/weekExport.ts

import type { Client, Entry } from './api'
import { clientLabel, clientRank } from './clients'
import { minutesBetween, toDateKey } from './dates'
import { exportProjectLabel } from './projects'
import {
  TASK_COPY_CELLS,
  buildProjectNames,
  buildTaskList,
  buildTicketList,
  taskCopyRow,
} from './tasks'

// one client's day, as the week export lists it
export type WeekExportRow = {
  date: string
  client: string
  minutes: number
  tasks: string[]
  tickets: string[]
  project: string
}

// one day of the export: a row per client logged that day, or none for a blank day
export type WeekExportDay = {
  date: string
  rows: WeekExportRow[]
}

// 'Mon, 8/10/2026', the date form the target spreadsheet uses
export const exportDateLabel = (d: Date): string =>
  `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`

// hours trimmed of trailing zeros, e.g. 90 -> '1.5', 180 -> '3', 105 -> '1.75'
export const compactHours = (minutes: number): string => String(Number((minutes / 60).toFixed(2)))

// every day of the week in order, each with its clients in configured order
export const buildWeekExport = (
  days: Date[],
  entries: Entry[],
  clients: Client[],
): WeekExportDay[] =>
  days.map((d) => {
    const key = toDateKey(d)
    const date = exportDateLabel(d)
    const byClient = new Map<string, Entry[]>()
    for (const e of entries) {
      if (e.date !== key) continue
      byClient.set(e.client, [...(byClient.get(e.client) ?? []), e])
    }
    const codes = Array.from(byClient.keys()).sort(
      (a, b) => clientRank(clients, a) - clientRank(clients, b) || a.localeCompare(b),
    )
    const rows = codes.map((client) => {
      const list = byClient.get(client)!
      return {
        date,
        client,
        minutes: list.reduce((acc, e) => acc + minutesBetween(e.startedAt, e.endedAt), 0),
        tasks: buildTaskList(list.map((e) => e.note)),
        tickets: buildTicketList(list.map((e) => e.ticket)),
        project: exportProjectLabel(
          clientLabel(clients, client),
          buildProjectNames(list.map((e) => e.project)),
        ),
      }
    })
    return { date, rows }
  })

// the clipboard payload: the day-copy row with the date in front, and a blank
//  day kept as its date plus empty cells so the pasted block stays seven days long
export const weekExportText = (week: WeekExportDay[]): string =>
  week
    .flatMap((day) =>
      day.rows.length
        ? day.rows.map(
            (r) =>
              `${r.date}\t${taskCopyRow(r.minutes, r.tasks, r.tickets, r.project, compactHours)}`,
          )
        : [`${day.date}${'\t'.repeat(TASK_COPY_CELLS)}`],
    )
    .join('\n')
