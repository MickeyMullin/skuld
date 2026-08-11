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
import { ceilToQuarter, floorToQuarter } from './rounding'

// overlaps are allowed through and flagged in the UI instead, so entries can be
//  saved in any order and reconciled afterwards
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

      return insertEntry({
        date: body.date,
        startedAt,
        endedAt,
        note: body.note ?? '',
        ticket: body.ticket ?? '',
        client: body.client,
      })
    },
    {
      body: t.Object({
        date: t.String(),
        startedAt: t.String(),
        endedAt: t.String(),
        note: t.Optional(t.String()),
        ticket: t.Optional(t.String()),
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
        ticket: body.ticket ?? existing.ticket,
        client: body.client ?? existing.client,
      }

      const startedAt = floorToQuarter(merged.startedAt)
      const endedAt = ceilToQuarter(merged.endedAt)

      if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
        set.status = 400
        return { error: 'End time must be after start time' }
      }

      return updateEntry(id, {
        date: merged.date,
        startedAt,
        endedAt,
        note: merged.note,
        ticket: merged.ticket,
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
        ticket: t.Optional(t.String()),
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
