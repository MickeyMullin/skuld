// server/src/routeIndex.ts

// GET /api/routes, built from Elysia's own route table so a new or changed
//  route shows up without anyone editing a list

export const API_DOCS_URL = 'https://github.com/MickeyMullin/skuld/blob/master/docs/api.md'

// the slice of a TypeBox schema this reads; Elysia keeps route schemas as TypeBox
type Schema = {
  type?: string
  format?: string
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  anyOf?: Schema[]
}

// a schema as a TypeScript-like label, with an object as a map of its fields
//  and an optional field marked by a trailing '?' on its name:
//  { from: 'string', externalId?: 'string' }
export type FieldShape = string | { [field: string]: FieldShape } | FieldShape[]

export const describeSchema = (schema: Schema): FieldShape => {
  if (schema.anyOf) {
    const labels = schema.anyOf.map((s) => String(describeSchema(s)))
    return Array.from(new Set(labels)).join(' | ')
  }
  if (schema.type === 'array') {
    const items = schema.items ? describeSchema(schema.items) : 'unknown'
    if (typeof items !== 'string') return [items]
    return items.includes(' | ') ? `(${items})[]` : `${items}[]`
  }
  // Elysia accepts a number as its string form too, which it writes as a
  //  formatted string alongside the number; both are the one number to a caller
  if (schema.type === 'string' && (schema.format === 'integer' || schema.format === 'numeric')) {
    return 'number'
  }
  if (schema.type === 'object' && schema.properties) {
    const required = new Set(schema.required ?? [])
    return Object.fromEntries(
      Object.entries(schema.properties).map(([name, s]) => [
        required.has(name) ? name : `${name}?`,
        describeSchema(s),
      ]),
    )
  }
  return schema.type === 'integer' ? 'number' : (schema.type ?? 'unknown')
}

export type RouteSummary = {
  method: string
  path: string
  params?: FieldShape
  query?: FieldShape
  body?: FieldShape
}

export type RouteIndex = {
  docs: string
  routes: RouteSummary[]
}

// the parts of an Elysia route entry this reads
type RouteEntry = {
  method: string
  path: string
  hooks?: { params?: unknown; query?: unknown; body?: unknown }
}

// every route in registration order, with the request schemas it validates
export const describeRoutes = (routes: RouteEntry[]): RouteIndex => ({
  docs: API_DOCS_URL,
  routes: routes.map(({ method, path, hooks }) => {
    const summary: RouteSummary = { method, path }
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = hooks?.[part]
      if (schema) summary[part] = describeSchema(schema as Schema)
    }
    return summary
  }),
})
