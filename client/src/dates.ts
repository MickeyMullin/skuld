// client/src/dates.ts

const DAY_MS = 24 * 60 * 60 * 1000
const QUARTER_MS = 15 * 60 * 1000

export const toDateKey = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const parseDateKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const startOfWeek = (d: Date): Date => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = copy.getDay() // 0 = Sunday, the week's first day
  copy.setDate(copy.getDate() - dow)
  return copy
}

export const addDays = (d: Date, n: number): Date => {
  const copy = new Date(d.getTime())
  copy.setDate(copy.getDate() + n)
  return copy
}

export const weekDays = (weekStart: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

export const sameWeek = (a: Date, b: Date): boolean =>
  toDateKey(startOfWeek(a)) === toDateKey(startOfWeek(b))

export const formatDayHeader = (d: Date): string =>
  d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

export const formatWeekRange = (weekStart: Date): string => {
  const end = addDays(weekStart, 6)
  const sameMonth = weekStart.getMonth() === end.getMonth()
  const startLabel = weekStart.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const endLabel = sameMonth
    ? end.toLocaleDateString(undefined, { day: 'numeric' })
    : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const year = end.getFullYear()
  return `${startLabel}–${endLabel}, ${year}`
}

export const formatDuration = (minutes: number): string => {
  if (minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export const minutesBetween = (startIso: string, endIso: string): number =>
  Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)

export const floorQuarter = (iso: string): string => {
  const d = new Date(iso)
  const floored = Math.floor(d.getTime() / QUARTER_MS) * QUARTER_MS
  return new Date(floored).toISOString()
}

export const ceilQuarter = (iso: string): string => {
  const d = new Date(iso)
  const ceiled = Math.ceil(d.getTime() / QUARTER_MS) * QUARTER_MS
  return new Date(ceiled).toISOString()
}

export const timeStringToIso = (dateKey: string, timeStr: string): string => {
  const [h, m] = timeStr.split(':').map(Number)
  const base = parseDateKey(dateKey)
  base.setHours(h, m, 0, 0)
  return base.toISOString()
}

export const isoToTimeString = (iso: string): string => {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export const formatTime = (iso: string): string => isoToTimeString(iso)

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export { DAY_MS, QUARTER_MS }
