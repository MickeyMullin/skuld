// client/src/projects.test.ts

import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_PROJECTS,
  addProject,
  buildProjectList,
  defaultProjectFor,
  projectsForClient,
} from './projects'

const PORTCITY = DEFAULT_PROJECTS[0].project

describe('buildProjectList', () => {
  test('always includes the standing defaults', () => {
    expect(buildProjectList([])).toEqual(DEFAULT_PROJECTS)
  })

  test('dedupes case-insensitively within a client, keeping first-seen casing', () => {
    const list = buildProjectList([
      { client: 'pc', project: PORTCITY.toUpperCase() },
      { client: 'WB', project: 'Site' },
      { client: 'WB', project: 'site' },
    ])
    expect(list).toEqual([
      { client: 'PC', project: PORTCITY },
      { client: 'WB', project: 'Site' },
    ])
  })

  test('keeps the same name under two clients as two projects', () => {
    const list = buildProjectList([
      { client: 'WB', project: 'Shared' },
      { client: 'PC', project: 'Shared' },
    ])
    expect(projectsForClient(list, 'PC')).toEqual([PORTCITY, 'Shared'])
    expect(projectsForClient(list, 'wb')).toEqual(['Shared'])
  })

  test('drops blank projects', () => {
    expect(buildProjectList([{ client: 'WB', project: '  ' }])).toEqual(DEFAULT_PROJECTS)
  })
})

describe('defaultProjectFor', () => {
  test('applies only to its own client', () => {
    const def = { client: 'PC', project: PORTCITY }
    expect(defaultProjectFor(def, 'pc')).toBe(PORTCITY)
    expect(defaultProjectFor(def, 'WB')).toBe('')
    expect(defaultProjectFor(null, 'PC')).toBe('')
  })
})

describe('addProject', () => {
  test('adds a new pairing and ignores a known or empty one', () => {
    const known = [{ client: 'WB', project: 'Site' }]
    expect(addProject(known, 'WB', 'site')).toBe(known)
    expect(addProject(known, 'WB', '')).toBe(known)
    expect(addProject(known, 'PC', 'Site')).toEqual([...known, { client: 'PC', project: 'Site' }])
  })
})
