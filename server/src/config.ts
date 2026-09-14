// server/src/config.ts

import { homedir } from 'node:os'
import { resolve } from 'node:path'

const env = (name: string, fallback: string): string => {
  const value = process.env[name]
  return value && value.trim() !== '' ? value.trim() : fallback
}

const expandHome = (p: string): string => (p.startsWith('~/') ? resolve(homedir(), p.slice(2)) : p)

// the server package lives one level below the repo root
const repoRoot = resolve(import.meta.dir, '..', '..')

export const config = {
  host: env('SKULD_HOST', '127.0.0.1'),
  port: Number(env('SKULD_PORT', '3456')),
  // absolute by default, so the database is the same file whichever directory bun was started from
  dbPath: resolve(expandHome(env('SKULD_DB', resolve(repoRoot, 'server', 'skuld.db')))),
  clientDist: resolve(repoRoot, 'client', 'dist'),
}

export type Config = typeof config
