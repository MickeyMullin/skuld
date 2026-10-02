// client/src/app.tsx

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createEntry,
  deleteEntry as apiDeleteEntry,
  fetchClients,
  fetchEntries,
  fetchProjects,
  updateEntry as apiUpdateEntry,
  type ClientProject,
  type Entry,
  type EntryInput,
} from './api'
import {
  addDays,
  formatWeekRange,
  isSameDay,
  parseDateParam,
  sameWeek,
  startOfWeek,
  toDateKey,
  weekDays,
} from './dates'
import { DaySection } from './components/DaySection'
import { WeekSummary } from './components/WeekSummary'
import { ConfigMenu } from './components/ConfigMenu'
import { buildClientList } from './clients'
import { addProject, buildProjectList } from './projects'
import {
  clearDefaultClient,
  clearDefaultProject,
  getDefaultClient,
  getDefaultProject,
  setDefaultClient,
  setDefaultProject,
} from './config'
import { DISCOVERY_URL, isDevServer, showDiscoveryLink } from './discovery'

export const App = () => {
  const [weekStart, setWeekStart] = useState(() => {
    const param = new URLSearchParams(window.location.search).get('week')
    return startOfWeek(parseDateParam(param) ?? new Date())
  })
  const [entries, setEntries] = useState<Entry[]>([])
  const [knownClients, setKnownClients] = useState<string[]>([])
  const [knownProjects, setKnownProjects] = useState<ClientProject[]>([])
  const [defaultClient, setDefaultClientState] = useState<string | null>(() =>
    getDefaultClient(),
  )
  const [defaultProject, setDefaultProjectState] = useState<ClientProject | null>(() =>
    getDefaultProject(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientOptions = useMemo(() => buildClientList(knownClients), [knownClients])
  const projectOptions = useMemo(() => buildProjectList(knownProjects), [knownProjects])

  // the default project is chosen from the default client's own projects, so
  //  it can't outlive a change of client; leaving it would quietly keep
  //  applying to the old client while no longer shown in settings
  const handleChangeDefault = (client: string) => {
    setDefaultClient(client)
    setDefaultClientState(client)
    if (defaultProject && defaultProject.client !== client) handleClearDefaultProject()
  }

  const handleClearDefault = () => {
    clearDefaultClient()
    setDefaultClientState(null)
    handleClearDefaultProject()
  }

  const handleChangeDefaultProject = (project: ClientProject) => {
    setDefaultProject(project)
    setDefaultProjectState(project)
  }

  const handleClearDefaultProject = () => {
    clearDefaultProject()
    setDefaultProjectState(null)
  }

  const today = new Date()
  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const fromKey = toDateKey(days[0])
  const toKey = toDateKey(days[days.length - 1])

  const loadWeek = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, clients, projects] = await Promise.all([
        fetchEntries(fromKey, toKey),
        fetchClients(),
        fetchProjects(),
      ])
      setEntries(list)
      setKnownClients(clients)
      setKnownProjects(projects)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [fromKey, toKey])

  useEffect(() => {
    loadWeek()
  }, [loadWeek])

  // keep the querystring in sync with the navigated week
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('week', toDateKey(weekStart))
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }, [weekStart])

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
    setKnownProjects((prev) => addProject(prev, created.client, created.project))
  }

  const handleUpdate = async (id: number, patch: Partial<Entry>) => {
    const updated = await apiUpdateEntry(id, patch)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    setKnownProjects((prev) => addProject(prev, updated.client, updated.project))
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
        {isDevServer && <span className="chip">Dev</span>}
        {showDiscoveryLink() && (
          <a className="discovery-link" href={DISCOVERY_URL}>
            ↩ discovery
          </a>
        )}
        <div className="week-nav">
          <button onClick={() => setWeekStart((d) => addDays(d, -7))}>← Prev</button>
          <span className="week-label">{formatWeekRange(weekStart)}</span>
          <button onClick={() => setWeekStart((d) => addDays(d, 7))}>Next →</button>
          <button
            className="primary"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            style={{ visibility: onCurrentWeek ? 'hidden' : 'visible' }}
            aria-hidden={onCurrentWeek}
            tabIndex={onCurrentWeek ? -1 : undefined}
          >
            Today
          </button>
        </div>
        <ConfigMenu
          clients={clientOptions}
          projects={projectOptions}
          defaultClient={defaultClient}
          defaultProject={defaultProject}
          onChangeDefault={handleChangeDefault}
          onChangeDefaultProject={handleChangeDefaultProject}
          onClearDefault={handleClearDefault}
          onClearDefaultProject={handleClearDefaultProject}
        />
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
                  knownProjects={knownProjects}
                  defaultClient={defaultClient}
                  defaultProject={defaultProject}
                  isToday={isToday}
                  defaultOpen={isToday}
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
