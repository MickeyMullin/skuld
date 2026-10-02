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
import { deleteEntry, getEntryById, insertEntry, listEntriesInRange, updateEntry } from './db'
import { ceilToQuarter, floorToQuarter } from './rounding'
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

// overlaps are allowed through and flagged in the UI instead, so entries can be
//  saved in any order and reconciled afterwards
export const routes = new Elysia({ prefix: '/api' })
  .get('/health', () => ({ ok: true, service: 'skuld', time: new Date().toISOString() }))
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

      return guard(set, () => {
        const client = ensureClient(body.client)
        return insertEntry({
          date: body.date,
          startedAt,
          endedAt,
          note: body.note ?? '',
          ticket: body.ticket ?? '',
          client,
          project: ensureProject(client, body.project ?? ''),
        })
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
