// server/src/overlap.ts

import { db } from './db'
import type { EntryRow } from './types'

type OverlapParams = {
  date: string
  startedAt: string
  endedAt: string
  excludeId?: number
}

export const hasOverlap = ({
  date,
  startedAt,
  endedAt,
  excludeId,
}: OverlapParams): boolean => {
  const rows = excludeId
    ? db
        .query<EntryRow, [string, number]>(
          `SELECT * FROM entries WHERE date = ? AND id != ?`,
        )
        .all(date, excludeId)
    : db
        .query<EntryRow, [string]>(`SELECT * FROM entries WHERE date = ?`)
        .all(date)

  return rows.some(
    (row) => startedAt < row.ended_at && endedAt > row.started_at,
  )
}
