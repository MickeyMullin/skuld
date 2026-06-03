// client/src/components/DaySection.tsx

import { Fragment, useEffect, useState } from 'react'
import type { Entry, EntryInput } from '../api'
import { formatDayHeader, formatDuration, minutesBetween } from '../dates'
import { buildTaskList } from '../tasks'
import { EntryForm } from './EntryForm'
import { EntryRow, clientBadgeClass } from './EntryRow'
import { TaskCopyOverlay } from './TaskCopyOverlay'

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
  const [copyClient, setCopyClient] = useState<string | null>(null)
  const [copyAnchor, setCopyAnchor] = useState<DOMRect | null>(null)

  // auto-show form whenever the day is opened
  useEffect(() => {
    if (open) setAdding(true)
  }, [open])

  const totalMins = entries.reduce(
    (acc, e) => acc + minutesBetween(e.startedAt, e.endedAt),
    0,
  )
  const byClient = sumByClient(entries)
  const perClient = Array.from(byClient.entries()).sort((a, b) =>
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
              <button
                key={c}
                type="button"
                className={`chip ${clientClass}`}
                title={`Copy ${c} tasks`}
                onClick={(e) => {
                  e.stopPropagation()
                  const header = e.currentTarget.closest('.day-header')
                  if (header) setCopyAnchor(header.getBoundingClientRect())
                  setCopyClient(c)
                }}
              >
                <span className={`chip-code ${clientClass}`}>{c}</span>{' '}
                {formatDuration(mins)}
              </button>
            )
          })}
        </span>
      </div>
      {open && (
        <div className="day-body">
          {entries.map((e, i) => {
            const prev = entries[i - 1]
            const gap = prev ? minutesBetween(prev.endedAt, e.startedAt) : 0
            return (
              <Fragment key={e.id}>
                {gap > 0 && (
                  <div className="entry-break" role="separator">
                    <span className="entry-break-label">{formatDuration(gap)} gap</span>
                  </div>
                )}
                <EntryRow
                  entry={e}
                  knownClients={knownClients}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              </Fragment>
            )
          })}
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
      {copyClient && copyAnchor && (
        <TaskCopyOverlay
          client={copyClient}
          minutes={byClient.get(copyClient) ?? 0}
          tasks={buildTaskList(
            entries.filter((e) => e.client === copyClient).map((e) => e.note),
          )}
          anchor={copyAnchor}
          onClose={() => setCopyClient(null)}
        />
      )}
    </div>
  )
}
