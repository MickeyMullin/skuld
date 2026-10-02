// client/src/api.ts

export type Entry = {
  id: number
  date: string
  startedAt: string
  endedAt: string
  note: string
  ticket: string
  client: string
  project: string
  createdAt: string
}

// a client and project name pairing, as the default project is stored
export type ClientProject = {
  client: string
  project: string
}

export type Client = {
  id: number
  code: string
  // full name for copy/export output; blank falls back to the code
  name: string
  active: boolean
  ordinal: number
}

// a project belongs to one client; the same name under two clients is two projects
export type Project = {
  id: number
  clientId: number
  // the owning client's code
  client: string
  name: string
  active: boolean
  ordinal: number
}

export type Settings = {
  preferredStartTime: string
}

export type EntryInput = {
  date: string
  startedAt: string
  endedAt: string
  note?: string
  ticket?: string
  client: string
  project?: string
}

export type EntryUpdate = Partial<EntryInput>

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      body && typeof body.error === 'string' ? body.error : `Request failed (${res.status})`
    throw new ApiError(res.status, message)
  }
  return body as T
}

export const fetchEntries = (from: string, to: string) =>
  request<Entry[]>(`/api/entries?from=${from}&to=${to}`)

export const createEntry = (input: EntryInput) =>
  request<Entry>('/api/entries', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateEntry = (id: number, input: EntryUpdate) =>
  request<Entry>(`/api/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const deleteEntry = (id: number) =>
  request<{ deleted: true }>(`/api/entries/${id}`, { method: 'DELETE' })

// every client, active or not, in configured order
export const fetchClients = () => request<Client[]>('/api/clients')

export const createClient = (input: { code: string; name?: string; active?: boolean }) =>
  request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(input) })

export const updateClient = (
  id: number,
  patch: Partial<Pick<Client, 'code' | 'name' | 'active'>>,
) => request<Client>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(patch) })

export const reorderClients = (ids: number[]) =>
  request<Client[]>('/api/clients/order', { method: 'PUT', body: JSON.stringify({ ids }) })

// every project, active or not, by client order then project order
export const fetchProjects = () => request<Project[]>('/api/projects')

export const createProject = (input: { clientId: number; name: string; active?: boolean }) =>
  request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) })

export const updateProject = (id: number, patch: Partial<Pick<Project, 'name' | 'active'>>) =>
  request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(patch) })

export const reorderProjects = (clientId: number, ids: number[]) =>
  request<Project[]>('/api/projects/order', {
    method: 'PUT',
    body: JSON.stringify({ clientId, ids }),
  })

export const fetchSettings = () => request<Settings>('/api/settings')

export const updateSettings = (patch: Partial<Settings>) =>
  request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(patch) })
