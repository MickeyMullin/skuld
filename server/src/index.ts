// server/src/index.ts

import { Elysia } from 'elysia'
import { config } from './config'
import { routes } from './routes'
import { serveStatic } from './static'

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
  // the deployed job serves the built client from the same port; in development Vite serves it
  //  instead and proxies /api here, so this path is only reached once client/dist exists
  .get('/*', ({ request }) => {
    const pathname = new URL(request.url).pathname
    // an unknown API path is a real 404, never the client shell
    if (pathname.startsWith('/api/') || pathname === '/api') {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    return serveStatic(config.clientDist, pathname)
  })
  .listen({ hostname: config.host, port: config.port })

console.log(`skuld server listening on http://${config.host}:${config.port}`)
console.log(`database: ${config.dbPath}`)

export type App = typeof app
