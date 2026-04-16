// client/src/components/EntryRow.tsx

import { useEffect, useState } from 'react'
import type { Entry } from '../api'
import { formatDuration, formatTime, minutesBetween } from '../dates'
import { EntryForm } from './EntryForm'

export const clientBadgeClass = (client: string): string => {
  const upper = client.toUpperCase()
  if (upper === 'PC') return 'client-badge client-pc'
  if (upper === 'WB') return 'client-badge client-wb'
  return 'client-badge client-other'
}

type Props = {
  entry: Entry
  knownClients: string[]
  onUpdate: (id: number, patch: Partial<Entry>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export const EntryRow = ({ entry, knownClients, onUpdate, onDelete }: Props) => {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  if (editing) {
    return (
      <div className="entry-row editing" style={{ display: 'block' }}>
        <EntryForm
          date={entry.date}
          knownClients={knownClients}
          initial={{
            startedAt: entry.startedAt,
            endedAt: entry.endedAt,
            note: entry.note,
            client: entry.client,
          }}
          submitLabel="Save"
          onSubmit={async (values) => {
            await onUpdate(entry.id, values)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const duration = minutesBetween(entry.startedAt, entry.endedAt)

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete(entry.id)
  }

  return (
    <div className="entry-row">
      <span className="entry-times">
        {formatTime(entry.startedAt)} – {formatTime(entry.endedAt)}
      </span>
      <span className="entry-duration">{formatDuration(duration)}</span>
      <span className="entry-note">{entry.note || <em style={{ opacity: 0.5 }}>—</em>}</span>
      <span className={clientBadgeClass(entry.client)}>{entry.client}</span>
      <span className="actions">
        <button className="ghost" onClick={() => setEditing(true)} title="Edit">
          ✎
        </button>
        <button
          className={confirmDelete ? 'ghost danger-confirm' : 'ghost'}
          onClick={handleDeleteClick}
          title={confirmDelete ? 'Click again to confirm' : 'Delete'}
        >
          ×
        </button>
      </span>
    </div>
  )
}
