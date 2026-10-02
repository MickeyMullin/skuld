// client/src/components/ClientsTable.tsx

import { useRef, useState } from 'react'
import type { Client } from '../api'
import { EditableText } from './EditableText'
import { useDragReorder } from './useDragReorder'

export type ClientInput = { code: string; name: string; active: boolean }

type Props = {
  clients: Client[]
  onCreate: (input: ClientInput) => Promise<Client>
  onSave: (id: number, patch: Partial<ClientInput>) => Promise<void>
  onReorder: (ids: number[]) => Promise<void>
}

// uppercased as typed; anything else a code can't hold is left for the server to
//  reject with a message, rather than swallowing keystrokes
const toCode = (raw: string) => raw.toUpperCase()

type RowProps = {
  client: Client | null
  handle: React.ButtonHTMLAttributes<HTMLButtonElement> & { draggable?: boolean }
  row: React.HTMLAttributes<HTMLTableRowElement>
  onCreate: (input: ClientInput) => Promise<void>
  onSave: (patch: Partial<ClientInput>) => Promise<void>
  onDiscard: () => void
}

// one client, or a blank row being filled in; the row is created once it has a code
const ClientRow = ({ client, handle, row, onCreate, onSave, onDiscard }: RowProps) => {
  const [pendingName, setPendingName] = useState('')
  const [pendingActive, setPendingActive] = useState(true)

  return (
    <tr {...row}>
      <td className="settings-thumb-cell">
        <button type="button" className="ghost settings-thumb" title="Drag to reorder" {...handle}>
          ⠿
        </button>
      </td>
      <td>
        <EditableText
          ariaLabel="Code"
          className="settings-code-input"
          value={client?.code ?? ''}
          placeholder="Code"
          maxLength={3}
          transform={toCode}
          onCommit={(code) =>
            client
              ? onSave({ code })
              : code
                ? onCreate({ code, name: pendingName, active: pendingActive })
                : Promise.resolve()
          }
        />
      </td>
      <td>
        <EditableText
          ariaLabel="Name"
          className="settings-name-input"
          value={client?.name ?? pendingName}
          placeholder={client ? client.code : 'Full name'}
          onCommit={async (name) => (client ? onSave({ name }) : setPendingName(name))}
        />
      </td>
      <td className="settings-active-cell">
        <input
          type="checkbox"
          aria-label="Active"
          checked={client?.active ?? pendingActive}
          onChange={(e) =>
            client ? onSave({ active: e.target.checked }).catch(() => {}) : setPendingActive(e.target.checked)
          }
        />
      </td>
      <td className="settings-row-actions">
        {!client && (
          <button type="button" className="ghost" title="Discard" onClick={onDiscard}>
            ×
          </button>
        )}
      </td>
    </tr>
  )
}

export const ClientsTable = ({ clients, onCreate, onSave, onReorder }: Props) => {
  const [drafts, setDrafts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const draftSeq = useRef(0)
  // a saved draft keeps its row key, so focus stays put as it turns into a client
  const keys = useRef(new Map<number, string>())

  const byId = new Map(clients.map((c) => [c.id, c]))
  const { order, handleProps, rowProps } = useDragReorder(
    clients.map((c) => c.id),
    true,
    (ids) => report(onReorder(ids)).catch(() => {}),
  )

  // runs a save, showing its failure above the table and rethrowing so the
  //  field can put itself back
  const report = async <T,>(work: Promise<T>): Promise<T> => {
    setError(null)
    try {
      return await work
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      throw err
    }
  }

  return (
    <div className="settings-table-wrap">
      {error && <div className="form-error">{error}</div>}
      <table className="settings-table">
        <thead>
          <tr>
            <th aria-label="Order" />
            <th>Code</th>
            <th>Name</th>
            <th>Active</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {/* one keyed list, so a draft's row is reused as it becomes a client */}
          {[
            ...order.map((id) => (
            <ClientRow
              key={keys.current.get(id) ?? `client-${id}`}
              client={byId.get(id)!}
              handle={handleProps(id)}
              row={rowProps(id)}
              onCreate={async () => {}}
              onSave={(patch) => report(onSave(id, patch))}
              onDiscard={() => {}}
            />
          )),
            ...drafts.map((key) => (
            <ClientRow
              key={key}
              client={null}
              handle={{ disabled: true }}
              row={{}}
              onCreate={async (input) => {
                const created = await report(onCreate(input))
                keys.current.set(created.id, key)
                setDrafts((prev) => prev.filter((k) => k !== key))
              }}
              onSave={async () => {}}
              onDiscard={() => setDrafts((prev) => prev.filter((k) => k !== key))}
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
                onClick={() => setDrafts((prev) => [...prev, `draft-${draftSeq.current++}`])}
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
