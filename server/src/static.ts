// server/src/static.ts

import { existsSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'

// serves the built client; extensionless paths fall back to index.html so the client owns them
export const serveStatic = (distDir: string, pathname: string): Response => {
  const root = resolve(distDir)
  const index = resolve(root, 'index.html')
  if (!existsSync(index)) {
    return new Response('Client build not found. Run `bun run build` first, or use the Vite dev server.', { status: 503 })
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // a malformed percent escape is a bad request, not a crash
    return new Response('Bad request', { status: 400 })
  }
  const target = resolve(root, `.${decoded}`)
  if (target.startsWith(`${root}/`) && existsSync(target) && statSync(target).isFile()) {
    return new Response(Bun.file(target))
  }
  if (extname(decoded) === '') return new Response(Bun.file(index))
  return new Response('Not found', { status: 404 })
}
