// client/src/components/DaySection.tsx

import { useEffect, useState } from 'react'
import type { Entry, EntryInput } from '../api'
import { formatDayHeader, formatDuration, minutesBetween } from '../dates'
import { EntryForm } from './EntryForm'
import { EntryRow, clientBadgeClass } from './EntryRow'

type Props = {
  date: Date
  dateKey: string
  entries: Entry[]
  knownClients: string[]
  isToday: boolean
  defaultOpen: boolean
  onCreate: (input: EntryInput) => Promise<void>
  onUpdate: (id: number, patch: Partial<Entry>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

const sumByClient = (entries: Entry[]): Map<string, number> => {
  const out = new Map<string, number>()
  for (const e of entries) {
    const mins = minutesBetween(e.startedAt, e.endedAt)
    out.set(e.client, (out.get(e.client) ?? 0) + mins)
  }
  return out
}

export const DaySection = ({
  date,
  dateKey,
  entries,
  knownClients,
  isToday,
  defaultOpen,
  onCreate,
  onUpdate,
  onDelete,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen)
  const [adding, setAdding] = useState(defaultOpen)
  const [formKey, setFormKey] = useState(0)

  // auto-show form whenever the day is opened
  useEffect(() => {
    if (open) setAdding(true)
  }, [open])

  const totalMins = entries.reduce(
    (acc, e) => acc + minutesBetween(e.startedAt, e.endedAt),
    0,
  )
  const perClient = Array.from(sumByClient(entries).entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )

  const lastEndIso = entries.length
    ? [...entries].sort((a, b) => a.endedAt.localeCompare(b.endedAt)).at(-1)!.endedAt
    : undefined

  return (
    <div className="day">
      <div className="day-header" onClick={() => setOpen((v) => !v)}>
        <span className={`day-chevron${open ? ' open' : ''}`}>▶</span>
        <span className="day-label">{formatDayHeader(date)}</span>
        {isToday && <span className="day-today-badge">Today</span>}
        <span className="day-total">{formatDuration(totalMins)}</span>
        <span className="day-chips">
          {perClient.map(([c, mins]) => {
            const clientClass = clientBadgeClass(c).replace('client-badge', '').trim()
            return (
              <span key={c} className={`chip ${clientClass}`}>
                <span className={`chip-code ${clientClass}`}>{c}</span>{' '}
                {formatDuration(mins)}
              </span>
            )
          })}
        </span>
      </div>
      {open && (
        <div className="day-body">
          {entries.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              knownClients={knownClients}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
          {adding ? (
            <EntryForm
              key={formKey}
              date={dateKey}
              knownClients={knownClients}
              submitLabel="Add"
              initial={
                lastEndIso
                  ? {
                      startedAt: lastEndIso,
                      endedAt: new Date(
                        new Date(lastEndIso).getTime() + 60 * 60 * 1000,
                      ).toISOString(),
                    }
                  : undefined
              }
              onSubmit={async (values) => {
                await onCreate({
                  date: dateKey,
                  startedAt: values.startedAt,
                  endedAt: values.endedAt,
                  note: values.note,
                  client: values.client,
                })
                setFormKey((k) => k + 1)
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button className="add-entry-btn" onClick={() => setAdding(true)}>
              + Add Entry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
