// client/src/projects.ts

import type { ClientProject } from './api'

// standing projects per client, always offered even before any entries use them
export const DEFAULT_PROJECTS: ClientProject[] = [
  { client: 'PC', project: 'PortCity Logistics - Dispatch Intelligence Platform II' },
]

// the canonical project options: the standing defaults unioned with any pairs
//  already seen on the server, deduped case-insensitively within each client
//  (first-seen casing wins) and sorted by client, then project
export const buildProjectList = (known: ClientProject[]): ClientProject[] => {
  const seen = new Map<string, ClientProject>()
  for (const p of [...DEFAULT_PROJECTS, ...known]) {
    const client = p.client.trim().toUpperCase()
    const project = p.project.trim()
    if (!client || !project) continue
    const key = `${client}\u0000${project.toLowerCase()}`
    if (!seen.has(key)) seen.set(key, { client, project })
  }
  return Array.from(seen.values()).sort(
    (a, b) =>
      a.client.localeCompare(b.client) ||
      a.project.toLowerCase().localeCompare(b.project.toLowerCase()),
  )
}

// the project names offered for one client
export const projectsForClient = (list: ClientProject[], client: string): string[] => {
  const upper = client.trim().toUpperCase()
  return list.filter((p) => p.client === upper).map((p) => p.project)
}

// the default project applies only to entries for the client it belongs to
export const defaultProjectFor = (
  defaultProject: ClientProject | null,
  client: string,
): string =>
  defaultProject && defaultProject.client === client.trim().toUpperCase()
    ? defaultProject.project
    : ''

// a newly used pairing to fold into the known list, or the list unchanged
export const addProject = (
  known: ClientProject[],
  client: string,
  project: string,
): ClientProject[] => {
  if (!project) return known
  const exists = known.some(
    (p) => p.client === client && p.project.toLowerCase() === project.toLowerCase(),
  )
  return exists ? known : [...known, { client, project }]
}
