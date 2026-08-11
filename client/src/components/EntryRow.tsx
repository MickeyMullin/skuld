// client/src/components/EntryRow.tsx

import { useState } from 'react'
import type { Entry } from '../api'
import { formatDuration, formatTime, minutesBetween } from '../dates'
import { ConfirmDialog } from './ConfirmDialog'
import { EntryForm } from './EntryForm'
import type { Suggestion } from '../suggestions'
import { normalizeTicketField } from '../tasks'

export const clientBadgeClass = (client: string): string => {
  const upper = client.toUpperCase()
  if (upper === 'PC') return 'client-badge client-pc'
  if (upper === 'WB') return 'client-badge client-wb'
  return 'client-badge client-other'
}

type Props = {
  entry: Entry
  knownClients: string[]
  noteSuggestions: Suggestion[]
  ticketSuggestions: Suggestion[]
  onUpdate: (id: number, patch: Partial<Entry>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export const EntryRow = ({
  entry,
  knownClients,
  noteSuggestions,
  ticketSuggestions,
  onUpdate,
  onDelete,
}: Props) => {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (editing) {
    return (
      <div className="entry-row editing" style={{ display: 'block' }}>
        <EntryForm
          date={entry.date}
          knownClients={knownClients}
          noteSuggestions={noteSuggestions}
          ticketSuggestions={ticketSuggestions}
          initial={{
            startedAt: entry.startedAt,
            endedAt: entry.endedAt,
            note: entry.note,
            ticket: entry.ticket,
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

  return (
    <div className="entry-row">
      <span className="entry-times">
        {formatTime(entry.startedAt)} – {formatTime(entry.endedAt)}
      </span>
      <span className="entry-duration">{formatDuration(duration)}</span>
      <span className="entry-note">{entry.note || <em style={{ opacity: 0.5 }}>—</em>}</span>
      {/* normalized on display too, so rows saved before this looked uniform */}
      <span className="entry-ticket">{normalizeTicketField(entry.ticket)}</span>
      <span className={clientBadgeClass(entry.client)}>{entry.client}</span>
      <span className="actions">
        <button className="ghost" onClick={() => setEditing(true)} title="Edit">
          ✎
        </button>
        <button className="ghost" onClick={() => setConfirming(true)} title="Delete">
          ×
        </button>
      </span>
      {confirming && (
        <ConfirmDialog
          title="Delete this entry?"
          confirmLabel="Delete"
          busyLabel="Deleting…"
          note="This can't be undone."
          onCancel={() => setConfirming(false)}
          onConfirm={() => onDelete(entry.id)}
        >
          {/* spell out which entry is going, since rows look alike at a glance */}
          <div className="confirm-entry">
            <span className="entry-times">
              {formatTime(entry.startedAt)} – {formatTime(entry.endedAt)}
            </span>
            <span className="entry-duration">{formatDuration(duration)}</span>
            <span className={clientBadgeClass(entry.client)}>{entry.client}</span>
          </div>
          <div className="confirm-entry-note">
            {entry.note || <em style={{ opacity: 0.5 }}>no note</em>}
            {entry.ticket && (
              <span className="entry-ticket"> {normalizeTicketField(entry.ticket)}</span>
            )}
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
