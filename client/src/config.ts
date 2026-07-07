// client/src/config.ts

// user preferences persisted to browser local storage; no server round-trip

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
