// server/src/routeIndex.test.ts

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeSchema } from './routeIndex'

// routes load the shared db module, so point it at a throwaway file first
const dir = mkdtempSync(join(tmpdir(), 'skuld-routes-'))
process.env.SKULD_DB = join(dir, 'test.db')
const { routes } = await import('./routes')

process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const listing = async () => {
  const res = await routes.handle(new Request('http://skuld.test/api/routes'))
  return { status: res.status, body: (await res.json()) as any }
}

describe('describeSchema', () => {
  test('marks optional fields and labels unions, arrays, and nesting', () => {
    expect(
      describeSchema({
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' } },
          externalId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          tags: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'boolean' }] } },
          range: {
            type: 'object',
            required: ['from'],
            properties: { from: { type: 'string' }, to: { type: 'string' } },
          },
        },
      }),
    ).toEqual({
      ids: 'number[]',
      'externalId?': 'string | null',
      'tags?': '(string | boolean)[]',
      'range?': { from: 'string', 'to?': 'string' },
    })
  })

  test("reads Elysia's string-or-number coercion as a number", () => {
    expect(
      describeSchema({ anyOf: [{ type: 'string', format: 'integer' }, { type: 'integer' }] }),
    ).toBe('number')
  })
})

describe('GET /api/routes', () => {
  test('lists every registered route, itself included, in registration order', async () => {
    const { status, body } = await listing()
    expect(status).toBe(200)
    expect(body.routes.map((r: any) => `${r.method} ${r.path}`)).toEqual(
      routes.routes.map((r) => `${r.method} ${r.path}`),
    )
    expect(body.routes).toContainEqual({ method: 'GET', path: '/api/routes' })
  })

  test('describes the request schemas a route validates', async () => {
    const { body } = await listing()
    const find = (method: string, path: string) =>
      body.routes.find((r: any) => r.method === method && r.path === path)
    expect(find('GET', '/api/entries')).toEqual({
      method: 'GET',
      path: '/api/entries',
      query: { from: 'string', to: 'string', 'externalId?': 'string' },
    })
    expect(find('PUT', '/api/projects/order').body).toEqual({ clientId: 'number', ids: 'number[]' })
    expect(find('PUT', '/api/clients/:id').params).toEqual({ id: 'number' })
  })
})

// the route list keeps itself current; this keeps the written reference in step with it
describe('docs/api.md covers the routes', () => {
  const doc = readFileSync(join(import.meta.dir, '..', '..', 'docs', 'api.md'), 'utf8')
  const documented = new Set(
    doc
      .split('\n')
      .filter((line) => line.startsWith('### '))
      .flatMap((line) => Array.from(line.matchAll(/`([A-Z]+) (\/api[^`?\s]*)/g)))
      .map(([, method, path]) => `${method} ${path}`),
  )
  const registered = routes.routes.map((r) => `${r.method} ${r.path}`)

  test('every registered route has a heading', () => {
    expect(registered.filter((r) => !documented.has(r))).toEqual([])
  })

  test('every route heading is a registered route', () => {
    expect([...documented].filter((r) => !registered.includes(r))).toEqual([])
  })
})
