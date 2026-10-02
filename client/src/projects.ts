// client/src/projects.ts

import type { Client, ClientProject, Project } from './api'

// the project names offered for one client: its active projects in their
//  configured order, plus the current value when it's inactive or new
export const projectOptions = (projects: Project[], client: string, current = ''): string[] => {
  const upper = client.trim().toUpperCase()
  const names = projects.filter((p) => p.client === upper && p.active).map((p) => p.name)
  const name = current.trim()
  return name && !names.includes(name) ? [...names, name] : names
}

// the default project applies only to entries for the client it belongs to
export const defaultProjectFor = (
  defaultProject: ClientProject | null,
  client: string,
): string =>
  defaultProject && defaultProject.client === client.trim().toUpperCase()
    ? defaultProject.project
    : ''

// the client-and-project cell for copy/export, e.g. 'PortCity Logistics -
//  Dispatch Intelligence Platform II'; just the client when no project was logged
export const exportProjectLabel = (clientLabel: string, projects: string[]): string =>
  projects.length ? `${clientLabel} - ${projects.join(', ')}` : clientLabel

// project names used to carry their client's name as a prefix, which the
//  export now adds itself. a default project saved in that form is rewritten to
//  the bare name once that name exists; null when there's nothing to change
export const upgradeDefaultProject = (
  defaultProject: ClientProject | null,
  clients: Client[],
  projects: Project[],
): ClientProject | null => {
  if (!defaultProject) return null
  const { client, project } = defaultProject
  const known = (name: string) => projects.some((p) => p.client === client && p.name === name)
  if (known(project)) return null
  const name = clients.find((c) => c.code === client)?.name.trim()
  const prefix = `${name} - `
  if (!name || !project.startsWith(prefix)) return null
  const bare = project.slice(prefix.length)
  return known(bare) ? { client, project: bare } : null
}
