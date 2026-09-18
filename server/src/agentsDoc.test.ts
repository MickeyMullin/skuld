// server/src/agentsDoc.test.ts

import { describe, expect, test } from 'bun:test'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8')

describe('AGENTS.md deployment docs stay honest', () => {
  test('points at a deploy script that actually exists and is executable', () => {
    expect(agents).toContain('deploy/skuld.sh')
    const stat = statSync(join(root, 'deploy', 'skuld.sh'))
    expect(stat.isFile()).toBe(true)
    expect(Boolean(stat.mode & 0o111)).toBe(true)
  })

  test('references the port the deployed job actually listens on', () => {
    const plist = readFileSync(join(root, 'deploy', 'com.mickey.skuld.plist'), 'utf8')
    const port = plist.match(/<key>SKULD_PORT<\/key>\s*<string>(\d+)<\/string>/)?.[1]
    expect(port).toBeTruthy()
    expect(agents).toContain(`127.0.0.1:${port}`)
  })

  test('CLAUDE.md links to it', () => {
    const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
    expect(claude).toContain('AGENTS.md')
  })
})
