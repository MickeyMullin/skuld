// client/src/components/SettingsPage.tsx

import { useCallback, useEffect, useState } from 'react'
import {
  createClient,
  createProject,
  fetchClients,
  fetchProjects,
  fetchSettings,
  reorderClients,
  reorderProjects,
  updateClient,
  updateProject,
  updateSettings,
  type Client,
  type Project,
} from '../api'
import { isDevServer } from '../discovery'
import { ClientsTable } from './ClientsTable'
import { ProjectsTable } from './ProjectsTable'
import { TimeInput } from './TimeInput'

// puts records in the order of the given ids; any not named keep their place after
const sortByIds = <T extends { id: number }>(items: T[], ids: number[]): T[] =>
  [...items].sort((a, b) => {
    const ia = ids.indexOf(a.id)
    const ib = ids.indexOf(b.id)
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
  })

export const SettingsPage = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [startTime, setStartTime] = useState<string | null>(null)
  const [startStatus, setStartStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // the timesheet's week rides along, so Back returns to where settings was opened
  const week = new URLSearchParams(window.location.search).get('week')
  const backHref = week ? `/?week=${encodeURIComponent(week)}` : '/'

  const load = useCallback(async () => {
    try {
      const [clientList, projectList, settings] = await Promise.all([
        fetchClients(),
        fetchProjects(),
        fetchSettings(),
      ])
      setClients(clientList)
      setProjects(projectList)
      setStartTime(settings.preferredStartTime)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [])

  useEffect(() => {
    document.title = 'Settings · Skuld'
    load()
  }, [load])

  const saveStartTime = async (value: string) => {
    if (value === startTime) return
    setStartTime(value)
    setStartStatus(null)
    try {
      const saved = await updateSettings({ preferredStartTime: value })
      setStartTime(saved.preferredStartTime)
      setStartStatus('Saved')
    } catch (err) {
      setStartStatus(err instanceof Error ? err.message : 'Save failed')
    }
  }

  // a project row shows its client's code, so a code change re-reads projects
  const saveClient = async (id: number, patch: Partial<Client>) => {
    const saved = await updateClient(id, patch)
    setClients((prev) => prev.map((c) => (c.id === id ? saved : c)))
    if (patch.code !== undefined) setProjects(await fetchProjects())
  }

  const addClient = async (input: { code: string; name: string; active: boolean }) => {
    const created = await createClient(input)
    setClients((prev) => [...prev, created])
    return created
  }

  // reordered in place at once, then settled to what the server stored; a
  //  failure reloads, so the table never shows an order that wasn't kept
  const moveClients = async (ids: number[]) => {
    setClients((prev) => sortByIds(prev, ids))
    try {
      setClients(await reorderClients(ids))
      setProjects(await fetchProjects())
    } catch (err) {
      await load()
      throw err
    }
  }

  const saveProject = async (id: number, patch: Partial<Project>) => {
    const saved = await updateProject(id, patch)
    setProjects((prev) => prev.map((p) => (p.id === id ? saved : p)))
  }

  const addProject = async (input: { clientId: number; name: string; active: boolean }) => {
    const created = await createProject(input)
    setProjects(await fetchProjects())
    return created
  }

  const moveProjects = async (clientId: number, ids: number[]) => {
    setProjects((prev) => sortByIds(prev, ids))
    try {
      setProjects(await reorderProjects(clientId, ids))
    } catch (err) {
      await load()
      throw err
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Skuld</h1>
        {isDevServer && <span className="chip">Dev</span>}
        <span className="settings-title">Settings</span>
        <a className="settings-back" href={backHref}>
          ← Back to timesheet
        </a>
      </header>
      {error && <div className="banner-error">{error}</div>}
      <main className="settings-main">
        <section className="settings-section">
          <h2 className="settings-heading">General</h2>
          <div className="settings-field">
            <label>Preferred start time</label>
            {startTime !== null && <TimeInput value={startTime} onChange={saveStartTime} />}
            {startStatus && <span className="settings-status">{startStatus}</span>}
          </div>
          <p className="settings-hint">
            Where a day's first entry starts. Later entries start where the previous one ended.
          </p>
        </section>
        <section className="settings-section">
          <h2 className="settings-heading">Clients</h2>
          <p className="settings-hint">
            The code is what the entry form's Client list shows, in this order; inactive clients
            are left out of it. The name is used when copying or exporting, falling back to the
            code.
          </p>
          <ClientsTable
            clients={clients}
            onCreate={addClient}
            onSave={saveClient}
            onReorder={moveClients}
          />
        </section>
        <section className="settings-section">
          <h2 className="settings-heading">Projects</h2>
          <ProjectsTable
            clients={clients}
            projects={projects}
            onCreate={addProject}
            onSave={saveProject}
            onReorder={moveProjects}
          />
        </section>
      </main>
    </div>
  )
}
