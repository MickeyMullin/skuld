// client/src/App.tsx

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createEntry,
  deleteEntry as apiDeleteEntry,
  fetchClients,
  fetchEntries,
  updateEntry as apiUpdateEntry,
  type Entry,
  type EntryInput,
} from './api'
import {
  addDays,
  formatWeekRange,
  isSameDay,
  sameWeek,
  startOfWeek,
  toDateKey,
  weekDays,
} from './dates'
import { DaySection } from './components/DaySection'
import { WeekSummary } from './components/WeekSummary'

export const App = () => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [entries, setEntries] = useState<Entry[]>([])
  const [knownClients, setKnownClients] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date()
  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const fromKey = toDateKey(days[0])
  const toKey = toDateKey(days[days.length - 1])

  const loadWeek = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, clients] = await Promise.all([
        fetchEntries(fromKey, toKey),
        fetchClients(),
      ])
      setEntries(list)
      setKnownClients(clients)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [fromKey, toKey])

  useEffect(() => {
    loadWeek()
  }, [loadWeek])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of entries) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    }
    return map
  }, [entries])

  const handleCreate = async (input: EntryInput) => {
    const created = await createEntry(input)
    setEntries((prev) => [...prev, created])
    if (!knownClients.includes(created.client)) {
      setKnownClients((prev) => [...prev, created.client].sort())
    }
  }

  const handleUpdate = async (id: number, patch: Partial<Entry>) => {
    const updated = await apiUpdateEntry(id, patch)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }

  const handleDelete = async (id: number) => {
    await apiDeleteEntry(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const onCurrentWeek = sameWeek(weekStart, today)

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Skuld</h1>
        <div className="week-nav">
          <button onClick={() => setWeekStart((d) => addDays(d, -7))}>← Prev</button>
          <span className="week-label">{formatWeekRange(weekStart)}</span>
          <button onClick={() => setWeekStart((d) => addDays(d, 7))}>Next →</button>
          {!onCurrentWeek && (
            <button
              className="primary"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              Today
            </button>
          )}
        </div>
      </header>
      {error && <div className="banner-error">{error}</div>}
      <main className="app-main">
        <div className="days">
          {loading && entries.length === 0 ? (
            <div className="loading">Loading…</div>
          ) : (
            days.map((d) => {
              const key = toDateKey(d)
              const dayEntries = entriesByDate.get(key) ?? []
              const isToday = isSameDay(d, today)
              return (
                <DaySection
                  key={key}
                  date={d}
                  dateKey={key}
                  entries={dayEntries}
                  knownClients={knownClients}
                  isToday={isToday}
                  defaultOpen={isToday || (!onCurrentWeek && dayEntries.length > 0)}
                  onCreate={handleCreate}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              )
            })
          )}
        </div>
        <WeekSummary entries={entries} />
      </main>
    </div>
  )
}
