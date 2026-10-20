// server/src/dateKeys.ts

// calendar math on YYYY-MM-DD day keys. a key is already a local day, so this
//  works in UTC purely as a calendar and never converts between timezones

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

const keyToUtc = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const utcToKey = (d: Date): string => d.toISOString().slice(0, 10)

// a well-formed key naming a real day, so 2026-02-30 is rejected rather than rolled over
export const isDateKey = (value: string): boolean => {
  const match = DATE_KEY.exec(value)
  if (!match) return false
  return utcToKey(keyToUtc(value)) === value
}

export const addDaysToKey = (key: string, n: number): string =>
  utcToKey(new Date(keyToUtc(key).getTime() + n * DAY_MS))

// the Sunday starting the key's week, matching startOfWeek in client/src/dates.ts
export const startOfWeekKey = (key: string): string => addDaysToKey(key, -keyToUtc(key).getUTCDay())

// the server's own local date, which is the user's, since both share a timezone
export const todayKey = (now: Date = new Date()): string => {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}
