// client/src/app.tsx

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createEntry,
  deleteEntry as apiDeleteEntry,
  fetchClients,
  fetchEntries,
  fetchProjects,
  fetchSettings,
  updateEntry as apiUpdateEntry,
  type Client,
  type ClientProject,
  type Entry,
  type EntryInput,
  type Project,
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
import { clientCodeOptions } from './clients'
import { upgradeDefaultProject } from './projects'
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
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [preferredStartTime, setPreferredStartTime] = useState('09:00')
  const [defaultClient, setDefaultClientState] = useState<string | null>(() =>
    getDefaultClient(),
  )
  const [defaultProject, setDefaultProjectState] = useState<ClientProject | null>(() =>
    getDefaultProject(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientOptions = useMemo(() => clientCodeOptions(clients), [clients])

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

  // saving an entry can add a client or project to the catalog, so it's
  //  re-read after each save as well as with the week
  const loadCatalog = useCallback(async () => {
    const [clientList, projectList] = await Promise.all([fetchClients(), fetchProjects()])
    setClients(clientList)
    setProjects(projectList)
  }, [])

  const loadWeek = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, settings] = await Promise.all([
        fetchEntries(fromKey, toKey),
        fetchSettings(),
        loadCatalog(),
      ])
      setEntries(list)
      setPreferredStartTime(settings.preferredStartTime)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [fromKey, toKey, loadCatalog])

  useEffect(() => {
    loadWeek()
  }, [loadWeek])

  // a default project saved while names still carried their client's prefix
  //  is moved onto the bare name it was migrated to
  useEffect(() => {
    const upgraded = upgradeDefaultProject(defaultProject, clients, projects)
    if (upgraded) handleChangeDefaultProject(upgraded)
  }, [defaultProject, clients, projects])

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

  // the entry itself is already saved, so a failed re-read isn't the form's error
  const refreshCatalog = () => {
    loadCatalog().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to reload clients'),
    )
  }

  const handleCreate = async (input: EntryInput) => {
    const created = await createEntry(input)
    setEntries((prev) => [...prev, created])
    refreshCatalog()
  }

  const handleUpdate = async (id: number, patch: Partial<Entry>) => {
    const updated = await apiUpdateEntry(id, patch)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    refreshCatalog()
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
          projects={projects}
          defaultClient={defaultClient}
          defaultProject={defaultProject}
          settingsHref={`/settings?week=${toDateKey(weekStart)}`}
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
                  clients={clients}
                  projects={projects}
                  defaultClient={defaultClient}
                  defaultProject={defaultProject}
                  preferredStartTime={preferredStartTime}
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
        <WeekSummary days={days} entries={entries} clients={clients} />
      </main>
    </div>
  )
}
