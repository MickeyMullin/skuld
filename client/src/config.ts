// client/src/config.ts

// user preferences persisted to browser local storage; no server round-trip

import type { ClientProject } from './api'

const DEFAULT_CLIENT_KEY = 'skuld.defaultClient'

export const getDefaultClient = (): string | null => {
  try {
    return window.localStorage.getItem(DEFAULT_CLIENT_KEY)
  } catch {
    return null
  }
}

export const setDefaultClient = (client: string): void => {
  try {
    window.localStorage.setItem(DEFAULT_CLIENT_KEY, client)
  } catch {
    // ignore write failures (private mode, quota, etc.)
  }
}

export const clearDefaultClient = (): void => {
  try {
    window.localStorage.removeItem(DEFAULT_CLIENT_KEY)
  } catch {
    // ignore
  }
}

const DEFAULT_PROJECT_KEY = 'skuld.defaultProject'

// stored with its client, since a project name only means something under one
export const getDefaultProject = (): ClientProject | null => {
  try {
    const raw = window.localStorage.getItem(DEFAULT_PROJECT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.client === 'string' && typeof parsed?.project === 'string'
      ? { client: parsed.client, project: parsed.project }
      : null
  } catch {
    return null
  }
}

export const setDefaultProject = (project: ClientProject): void => {
  try {
    window.localStorage.setItem(DEFAULT_PROJECT_KEY, JSON.stringify(project))
  } catch {
    // ignore write failures (private mode, quota, etc.)
  }
}

export const clearDefaultProject = (): void => {
  try {
    window.localStorage.removeItem(DEFAULT_PROJECT_KEY)
  } catch {
    // ignore
  }
}
