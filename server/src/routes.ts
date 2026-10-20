// server/src/routes.ts

import { Elysia, t } from 'elysia'
import {
  createClient,
  createProject,
  ensureClient,
  ensureProject,
  getSettings,
  listClients,
  listProjects,
  reorderClients,
  reorderProjects,
  updateClient,
  updateProject,
  updateSettings,
} from './catalog'
import {
  deleteEntry,
  getEntryByExternalId,
  getEntryById,
  insertEntry,
  listEntriesInRange,
  updateEntry,
} from './db'
import { isDateKey } from './dateKeys'
import { ceilToQuarter, floorToQuarter } from './rounding'
import { describeRoutes, type RouteIndex } from './routeIndex'
import { getSummary, getWeeks } from './summary'
import { isRequestError } from './types'

// runs a handler, turning a RequestError into its status and message
const guard = <T,>(set: { status?: number | string }, fn: () => T): T | { error: string } => {
  try {
    return fn()
  } catch (err) {
    if (!isRequestError(err)) throw err
    set.status = err.status
    return { error: err.message }
  }
}

const idParams = t.Object({ id: t.Numeric() })

// the field errors rounding can't get past; null when the entry's times are usable
const entryFieldError = (date: string, startedAt: string, endedAt: string): string | null => {
  if (!isDateKey(date)) return 'date must be a YYYY-MM-DD date'
  if (Number.isNaN(Date.parse(startedAt))) return 'startedAt must be an ISO 8601 timestamp'
  if (Number.isNaN(Date.parse(endedAt))) return 'endedAt must be an ISO 8601 timestamp'
  return null
}

// a blank externalId is no key at all
const normalizeExternalId = (raw: string | null | undefined): string | null =>
  raw?.trim() || null

// overlaps are allowed through and flagged in the UI instead, so entries can be
//  saved in any order and reconciled afterwards
export const routes = new Elysia({ prefix: '/api' })
  .get('/health', () => ({ ok: true, service: 'skuld', time: new Date().toISOString() }))
  // read at request time, so the list includes every route chained after this one
  .get('/routes', (): RouteIndex => describeRoutes(routes.routes))
  .get(
    '/entries',
    ({ query }) => {
      return listEntriesInRange(query.from, query.to, normalizeExternalId(query.externalId) ?? undefined)
    },
    {
      query: t.Object({
        from: t.String(),
        to: t.String(),
        externalId: t.Optional(t.String()),
      }),
    },
  )
  .get('/summary', ({ query, set }) => guard(set, () => getSummary(query.from, query.to)), {
    query: t.Object({ from: t.String(), to: t.String() }),
  })
  .get('/weeks', ({ query, set }) => guard(set, () => getWeeks(query)), {
    query: t.Object({
      count: t.Optional(t.String()),
      before: t.Optional(t.String()),
      includeCurrent: t.Optional(t.String()),
    }),
  })
  .post(
    '/entries',
    ({ body, set }) => {
      const fieldError = entryFieldError(body.date, body.startedAt, body.endedAt)
      if (fieldError) {
        set.status = 400
        return { error: fieldError }
      }

      const startedAt = floorToQuarter(body.startedAt)
      const endedAt = ceilToQuarter(body.endedAt)

      if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
        set.status = 400
        return { error: 'End time must be after start time' }
      }

      return guard(set, () => {
        const client = ensureClient(body.client)
        const params = {
          date: body.date,
          startedAt,
          endedAt,
          note: body.note ?? '',
          ticket: body.ticket ?? '',
          client,
          project: ensureProject(client, body.project ?? ''),
          externalId: normalizeExternalId(body.externalId),
        }
        // a repeated externalId replaces the entry it already names, so a
        //  retried or re-run job leaves one row rather than two
        const existing = params.externalId ? getEntryByExternalId(params.externalId) : null
        return existing ? updateEntry(existing.id, params) : insertEntry(params)
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
        project: t.Optional(t.String()),
        externalId: t.Optional(t.String()),
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
        project: body.project ?? existing.project,
        externalId:
          body.externalId === undefined ? existing.externalId : normalizeExternalId(body.externalId),
      }

      const fieldError = entryFieldError(merged.date, merged.startedAt, merged.endedAt)
      if (fieldError) {
        set.status = 400
        return { error: fieldError }
      }

      const startedAt = floorToQuarter(merged.startedAt)
      const endedAt = ceilToQuarter(merged.endedAt)

      if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
        set.status = 400
        return { error: 'End time must be after start time' }
      }

      return guard(set, () => {
        const client = ensureClient(merged.client)
        return updateEntry(id, {
          date: merged.date,
          startedAt,
          endedAt,
          note: merged.note,
          ticket: merged.ticket,
          client,
          project: ensureProject(client, merged.project),
          externalId: merged.externalId,
        })
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
        project: t.Optional(t.String()),
        externalId: t.Optional(t.Nullable(t.String())),
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
  .post('/clients', ({ body, set }) => guard(set, () => createClient(body)), {
    body: t.Object({
      code: t.String(),
      name: t.Optional(t.String()),
      active: t.Optional(t.Boolean()),
    }),
  })
  .put('/clients/order', ({ body }) => reorderClients(body.ids), {
    body: t.Object({ ids: t.Array(t.Integer()) }),
  })
  .put('/clients/:id', ({ params, body, set }) => guard(set, () => updateClient(params.id, body)), {
    params: idParams,
    body: t.Object({
      code: t.Optional(t.String()),
      name: t.Optional(t.String()),
      active: t.Optional(t.Boolean()),
    }),
  })
  .get('/projects', () => listProjects())
  .post('/projects', ({ body, set }) => guard(set, () => createProject(body)), {
    body: t.Object({
      clientId: t.Integer(),
      name: t.String(),
      active: t.Optional(t.Boolean()),
    }),
  })
  .put('/projects/order', ({ body }) => reorderProjects(body.clientId, body.ids), {
    body: t.Object({ clientId: t.Integer(), ids: t.Array(t.Integer()) }),
  })
  .put(
    '/projects/:id',
    ({ params, body, set }) => guard(set, () => updateProject(params.id, body)),
    {
      params: idParams,
      body: t.Object({
        name: t.Optional(t.String()),
        active: t.Optional(t.Boolean()),
      }),
    },
  )
  .get('/settings', () => getSettings())
  .put('/settings', ({ body, set }) => guard(set, () => updateSettings(body)), {
    body: t.Object({ preferredStartTime: t.Optional(t.String()) }),
  })
