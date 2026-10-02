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

// a project belongs to one client; the same name under two clients is two projects
export type ClientProject = {
  client: string
  project: string
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

export const fetchClients = () => request<string[]>('/api/clients')

export const fetchProjects = () => request<ClientProject[]>('/api/projects')
