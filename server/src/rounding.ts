// server/src/rounding.ts

const QUARTER_MS = 15 * 60 * 1000

export const floorToQuarter = (iso: string): string => {
  const d = new Date(iso)
  const floored = Math.floor(d.getTime() / QUARTER_MS) * QUARTER_MS
  return new Date(floored).toISOString()
}

export const ceilToQuarter = (iso: string): string => {
  const d = new Date(iso)
  const ceiled = Math.ceil(d.getTime() / QUARTER_MS) * QUARTER_MS
  return new Date(ceiled).toISOString()
}
