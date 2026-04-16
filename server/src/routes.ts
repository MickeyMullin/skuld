// server/src/routes.ts

import { Elysia, t } from 'elysia'
import {
  deleteEntry,
  getEntryById,
  insertEntry,
  listClients,
  listEntriesInRange,
  updateEntry,
} from './db'
import { hasOverlap } from './overlap'
import { ceilToQuarter, floorToQuarter } from './rounding'

const OVERLAP_MESSAGE = 'This entry overlaps with an existing one'

export const routes = new Elysia({ prefix: '/api' })
  .get(
    '/entries',
    ({ query }) => {
      return listEntriesInRange(query.from, query.to)
    },
    {
      query: t.Object({
        from: t.String(),
        to: t.String(),
      }),
    },
  )
  .post(
    '/entries',
    ({ body, set }) => {
      const startedAt = floorToQuarter(body.startedAt)
      const endedAt = ceilToQuarter(body.endedAt)

      if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
        set.status = 400
        return { error: 'End time must be after start time' }
      }

      if (
        hasOverlap({
          date: body.date,
          startedAt,
          endedAt,
        })
      ) {
        set.status = 409
        return { error: OVERLAP_MESSAGE }
      }

      return insertEntry({
        date: body.date,
        startedAt,
        endedAt,
        note: body.note ?? '',
        client: body.client,
      })
    },
    {
      body: t.Object({
        date: t.String(),
        startedAt: t.String(),
        endedAt: t.String(),
        note: t.Optional(t.String()),
        client: t.String(),
      }),
    },
  )
  .put(
    '/entries/:id',
    ({ params, body, set }) => {
      const id = Number(params.id)
      const existing = getEntryById(id)
      if (!existing) {
        set.status = 404
        return { error: 'Entry not found' }
      }

      const merged = {
        date: body.date ?? existing.date,
        startedAt: body.startedAt ?? existing.startedAt,
        endedAt: body.endedAt ?? existing.endedAt,
        note: body.note ?? existing.note,
        client: body.client ?? existing.client,
      }

      const startedAt = floorToQuarter(merged.startedAt)
      const endedAt = ceilToQuarter(merged.endedAt)

      if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
        set.status = 400
        return { error: 'End time must be after start time' }
      }

      if (
        hasOverlap({
          date: merged.date,
          startedAt,
          endedAt,
          excludeId: id,
        })
      ) {
        set.status = 409
        return { error: OVERLAP_MESSAGE }
      }

      return updateEntry(id, {
        date: merged.date,
        startedAt,
        endedAt,
        note: merged.note,
        client: merged.client,
      })
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        date: t.Optional(t.String()),
        startedAt: t.Optional(t.String()),
        endedAt: t.Optional(t.String()),
        note: t.Optional(t.String()),
        client: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    '/entries/:id',
    ({ params, set }) => {
      const id = Number(params.id)
      const ok = deleteEntry(id)
      if (!ok) {
        set.status = 404
        return { error: 'Entry not found' }
      }
      return { deleted: true }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get('/clients', () => listClients())
