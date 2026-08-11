// client/src/components/DaySection.tsx

import { Fragment, useCallback, useEffect, useState } from 'react'
import type { Entry, EntryInput } from '../api'
import { formatDayHeader, formatDuration, minutesBetween } from '../dates'
import { buildTaskList, buildTicketList } from '../tasks'
import { buildNoteSuggestions, buildTicketSuggestions } from '../suggestions'
import { EntryForm } from './EntryForm'
import { EntryRow, clientBadgeClass } from './EntryRow'
import { TaskCopyOverlay } from './TaskCopyOverlay'

type Props = {
  date: Date
  dateKey: string
  entries: Entry[]
  knownClients: string[]
  defaultClient: string | null
  isToday: boolean
  defaultOpen: boolean
  onCreate: (input: EntryInput) => Promise<void>
  onUpdate: (id: number, patch: Partial<Entry>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

// minutes between each entry and everything logged before it in the day:
//  positive is an unbilled gap, negative means it overlaps time already on the
//  books. measured against the furthest end seen so far rather than just the
//  previous entry, so a long entry swallowing a later short one is still caught
const breaksBefore = (entries: Entry[]): number[] => {
  const out: number[] = []
  let maxEnd: string | undefined
  for (const e of entries) {
    out.push(maxEnd ? minutesBetween(maxEnd, e.startedAt) : 0)
    if (!maxEnd || e.endedAt > maxEnd) maxEnd = e.endedAt
  }
  return out
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
  defaultClient,
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

  const closeCopy = useCallback(() => setCopyClient(null), [])

  // auto-show form whenever the day is opened
  useEffect(() => {
    if (open) setAdding(true)
  }, [open])

  // autocomplete draws only on what's already been logged this day
  const noteSuggestions = buildNoteSuggestions(entries)
  const ticketSuggestions = buildTicketSuggestions(entries)

  const totalMins = entries.reduce(
    (acc, e) => acc + minutesBetween(e.startedAt, e.endedAt),
    0,
  )
  const byClient = sumByClient(entries)
  const perClient = Array.from(byClient.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )

  const breaks = breaksBefore(entries)

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
                className={`chip ${clientClass}${copyClient === c ? ' chip-active' : ''}`}
                data-copy-key={`${dateKey}:${c}`}
                title={`Copy ${c} tasks`}
                onClick={(e) => {
                  e.stopPropagation()
                  const header = e.currentTarget.closest('.day-header')
                  if (header) setCopyAnchor(header.getBoundingClientRect())
                  // an open dialog for any other day+client has already closed
                  //  itself on mousedown, so this only ever toggles our own
                  setCopyClient((prev) => (prev === c ? null : c))
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
            const brk = breaks[i]
            return (
              <Fragment key={e.id}>
                {brk > 0 && (
                  <div className="entry-break" role="separator">
                    <span className="entry-break-label">{formatDuration(brk)} gap</span>
                  </div>
                )}
                {brk < 0 && (
                  <div className="entry-break overlap" role="separator">
                    <span className="entry-break-label">
                      {formatDuration(-brk)} overlap
                    </span>
                  </div>
                )}
                <EntryRow
                  entry={e}
                  knownClients={knownClients}
                  noteSuggestions={noteSuggestions}
                  ticketSuggestions={ticketSuggestions}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              </Fragment>
            )
          })}
          {adding ? (
            <EntryForm
              key={`${formKey}-${defaultClient ?? ''}`}
              date={dateKey}
              knownClients={knownClients}
              noteSuggestions={noteSuggestions}
              ticketSuggestions={ticketSuggestions}
              submitLabel="Add"
              initial={{
                ...(defaultClient ? { client: defaultClient } : {}),
                ...(lastEndIso
                  ? {
                      startedAt: lastEndIso,
                      endedAt: new Date(
                        new Date(lastEndIso).getTime() + 60 * 60 * 1000,
                      ).toISOString(),
                    }
                  : {}),
              }}
              onSubmit={async (values) => {
                await onCreate({
                  date: dateKey,
                  startedAt: values.startedAt,
                  endedAt: values.endedAt,
                  note: values.note,
                  ticket: values.ticket,
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
          chipKey={`${dateKey}:${copyClient}`}
          minutes={byClient.get(copyClient) ?? 0}
          tickets={buildTicketList(
            entries.filter((e) => e.client === copyClient).map((e) => e.ticket),
          )}
          tasks={buildTaskList(
            entries.filter((e) => e.client === copyClient).map((e) => e.note),
          )}
          anchor={copyAnchor}
          onClose={closeCopy}
        />
      )}
    </div>
  )
}
