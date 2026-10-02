// client/src/components/ProjectsTable.tsx

import { useRef, useState } from 'react'
import type { Client, Project } from '../api'
import { EditableText } from './EditableText'
import { clientBadgeClass } from './EntryRow'
import { useDragReorder } from './useDragReorder'

export type ProjectInput = { clientId: number; name: string; active: boolean }

type Props = {
  clients: Client[]
  projects: Project[]
  onCreate: (input: ProjectInput) => Promise<Project>
  onSave: (id: number, patch: Partial<Omit<ProjectInput, 'clientId'>>) => Promise<void>
  onReorder: (clientId: number, ids: number[]) => Promise<void>
}

const ALL = 'all'

type Draft = { key: string; clientId: number }

type RowProps = {
  project: Project | null
  clients: Client[]
  // a blank row's client; fixed when the table is filtered to one
  draftClientId: number
  clientLocked: boolean
  handle: React.ButtonHTMLAttributes<HTMLButtonElement> & { draggable?: boolean }
  row: React.HTMLAttributes<HTMLTableRowElement>
  onDraftClient: (clientId: number) => void
  onCreate: (input: ProjectInput) => Promise<void>
  onSave: (patch: Partial<Omit<ProjectInput, 'clientId'>>) => Promise<void>
  onDiscard: () => void
}

// one project, or a blank row being filled in; the row is created once it has a name
const ProjectRow = ({
  project,
  clients,
  draftClientId,
  clientLocked,
  handle,
  row,
  onDraftClient,
  onCreate,
  onSave,
  onDiscard,
}: RowProps) => {
  const [pendingActive, setPendingActive] = useState(true)
  const draftClient = clients.find((c) => c.id === draftClientId)

  return (
    <tr {...row}>
      <td className="settings-thumb-cell">
        <button type="button" className="ghost settings-thumb" title="Drag to reorder" {...handle}>
          ⠿
        </button>
      </td>
      <td>
        {project || clientLocked ? (
          <span className={clientBadgeClass(project?.client ?? draftClient?.code ?? '')}>
            {project?.client ?? draftClient?.code}
          </span>
        ) : (
          <select
            aria-label="Client"
            value={draftClientId}
            onChange={(e) => onDraftClient(Number(e.target.value))}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        )}
      </td>
      <td>
        <EditableText
          ariaLabel="Name"
          className="settings-name-input"
          value={project?.name ?? ''}
          placeholder="Project name"
          onCommit={(name) =>
            project
              ? onSave({ name })
              : name
                ? onCreate({ clientId: draftClientId, name, active: pendingActive })
                : Promise.resolve()
          }
        />
      </td>
      <td className="settings-active-cell">
        <input
          type="checkbox"
          aria-label="Active"
          checked={project?.active ?? pendingActive}
          onChange={(e) =>
            project
              ? onSave({ active: e.target.checked }).catch(() => {})
              : setPendingActive(e.target.checked)
          }
        />
      </td>
      <td className="settings-row-actions">
        {!project && (
          <button type="button" className="ghost" title="Discard" onClick={onDiscard}>
            ×
          </button>
        )}
      </td>
    </tr>
  )
}

export const ProjectsTable = ({ clients, projects, onCreate, onSave, onReorder }: Props) => {
  const [filter, setFilter] = useState<string>(ALL)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [error, setError] = useState<string | null>(null)
  const draftSeq = useRef(0)
  // a saved draft keeps its row key, so focus stays put as it turns into a project
  const keys = useRef(new Map<number, string>())

  const filterClientId = filter === ALL ? null : Number(filter)
  // already in client order, then project order, from the server
  const shown = projects.filter((p) => filterClientId === null || p.clientId === filterClientId)
  const shownDrafts = drafts.filter(
    (d) => filterClientId === null || d.clientId === filterClientId,
  )
  const byId = new Map(projects.map((p) => [p.id, p]))

  // order only means something within one client, so dragging needs a filter
  const { order, handleProps, rowProps } = useDragReorder(
    shown.map((p) => p.id),
    filterClientId !== null,
    (ids) => {
      if (filterClientId !== null) report(onReorder(filterClientId, ids)).catch(() => {})
    },
  )

  const report = async <T,>(work: Promise<T>): Promise<T> => {
    setError(null)
    try {
      return await work
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      throw err
    }
  }

  const dropDraft = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key))

  return (
    <div className="settings-table-wrap">
      <div className="settings-filter">
        <label htmlFor="project-client-filter">Client</label>
        <select
          id="project-client-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value={ALL}>All</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
        {filterClientId === null && (
          <span className="settings-hint">Pick a client to reorder its projects</span>
        )}
      </div>
      {error && <div className="form-error">{error}</div>}
      <table className="settings-table">
        <thead>
          <tr>
            <th aria-label="Order" />
            <th>Client</th>
            <th>Name</th>
            <th>Active</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {/* one keyed list, so a draft's row is reused as it becomes a project */}
          {[
            ...order.map((id) => (
              <ProjectRow
                key={keys.current.get(id) ?? `project-${id}`}
                project={byId.get(id)!}
                clients={clients}
                draftClientId={0}
                clientLocked
                handle={handleProps(id)}
                row={rowProps(id)}
                onDraftClient={() => {}}
                onCreate={async () => {}}
                onSave={(patch) => report(onSave(id, patch))}
                onDiscard={() => {}}
              />
            )),
            ...shownDrafts.map((d) => (
              <ProjectRow
                key={d.key}
                project={null}
                clients={clients}
                draftClientId={d.clientId}
                clientLocked={filterClientId !== null}
                handle={{ disabled: true }}
                row={{}}
                onDraftClient={(clientId) =>
                  setDrafts((prev) => prev.map((x) => (x.key === d.key ? { ...x, clientId } : x)))
                }
                onCreate={async (input) => {
                  const created = await report(onCreate(input))
                  keys.current.set(created.id, d.key)
                  dropDraft(d.key)
                }}
                onSave={async () => {}}
                onDiscard={() => dropDraft(d.key)}
              />
            )),
          ]}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>
              <button
                type="button"
                className="add-entry-btn"
                disabled={clients.length === 0}
                onClick={() =>
                  setDrafts((prev) => [
                    ...prev,
                    { key: `draft-${draftSeq.current++}`, clientId: filterClientId ?? clients[0].id },
                  ])
                }
              >
                + Add
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
