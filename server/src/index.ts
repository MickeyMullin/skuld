// server/src/index.ts

import { Elysia } from 'elysia'
import { routes } from './routes'

const PORT = 3456

const app = new Elysia()
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400
      return { error: 'Invalid request body' }
    }
    console.error(error)
    set.status = 500
    return { error: 'Internal server error' }
  })
  .use(routes)
  .listen(PORT)

console.log(`skuld server listening on http://localhost:${PORT}`)

export type App = typeof app
