// client/src/projects.test.ts

import { describe, expect, test } from 'bun:test'
import type { Client, Project } from './api'
import {
  defaultProjectFor,
  exportProjectLabel,
  projectOptions,
  upgradeDefaultProject,
} from './projects'

const clients: Client[] = [
  { id: 1, code: 'PC', name: 'PortCity Logistics', active: true, ordinal: 0 },
  { id: 2, code: 'WB', name: '', active: true, ordinal: 1 },
]

const project = (id: number, client: string, name: string, active = true): Project => ({
  id,
  clientId: client === 'PC' ? 1 : 2,
  client,
  name,
  active,
  ordinal: id,
})

const projects = [
  project(1, 'PC', 'Dispatch Intelligence Platform II'),
  project(2, 'PC', 'Retired', false),
  project(3, 'WB', 'Site'),
]

describe('projectOptions', () => {
  test('offers a client\'s active projects in order', () => {
    expect(projectOptions(projects, 'pc')).toEqual(['Dispatch Intelligence Platform II'])
  })

  test('keeps an inactive or unknown current value', () => {
    expect(projectOptions(projects, 'PC', 'Retired')).toEqual([
      'Dispatch Intelligence Platform II',
      'Retired',
    ])
    expect(projectOptions(projects, 'PC', 'Dispatch Intelligence Platform II')).toHaveLength(1)
  })
})

describe('defaultProjectFor', () => {
  const dflt = { client: 'PC', project: 'Dispatch Intelligence Platform II' }

  test('applies only to its own client', () => {
    expect(defaultProjectFor(dflt, 'pc')).toBe(dflt.project)
    expect(defaultProjectFor(dflt, 'WB')).toBe('')
    expect(defaultProjectFor(null, 'PC')).toBe('')
  })
})

describe('exportProjectLabel', () => {
  test('joins the client label and projects', () => {
    expect(exportProjectLabel('PortCity Logistics', ['Dispatch Intelligence Platform II'])).toBe(
      'PortCity Logistics - Dispatch Intelligence Platform II',
    )
    expect(exportProjectLabel('WB', [])).toBe('WB')
  })
})

describe('upgradeDefaultProject', () => {
  test('drops a legacy client-name prefix once the bare name exists', () => {
    expect(
      upgradeDefaultProject(
        { client: 'PC', project: 'PortCity Logistics - Dispatch Intelligence Platform II' },
        clients,
        projects,
      ),
    ).toEqual({ client: 'PC', project: 'Dispatch Intelligence Platform II' })
  })

  test('leaves a current or unmatched default alone', () => {
    expect(
      upgradeDefaultProject(
        { client: 'PC', project: 'Dispatch Intelligence Platform II' },
        clients,
        projects,
      ),
    ).toBeNull()
    expect(
      upgradeDefaultProject({ client: 'PC', project: 'PortCity Logistics - Gone' }, clients, projects),
    ).toBeNull()
    expect(upgradeDefaultProject(null, clients, projects)).toBeNull()
  })
})
