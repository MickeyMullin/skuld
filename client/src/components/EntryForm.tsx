// client/src/components/EntryForm.tsx

import { useEffect, useRef, useState } from 'react'
import {
  ceilQuarter,
  floorQuarter,
  isoToTimeString,
  timeStringToIso,
} from '../dates'
import { TimeInput } from './TimeInput'
import { AutocompleteInput } from './AutocompleteInput'
import { DEFAULT_CLIENTS, buildClientList } from '../clients'
import type { Suggestion } from '../suggestions'
import { normalizeTicketField } from '../tasks'

type FormValues = {
  startedAt: string
  endedAt: string
  note: string
  ticket: string
  client: string
}

type Props = {
  date: string
  knownClients: string[]
  noteSuggestions: Suggestion[]
  ticketSuggestions: Suggestion[]
  initial?: Partial<FormValues>
  submitLabel: string
  onSubmit: (values: FormValues) => Promise<void>
  onCancel: () => void
}

const OTHER_SENTINEL = '__other__'

export const EntryForm = ({
  date,
  knownClients,
  noteSuggestions,
  ticketSuggestions,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) => {
  const clients = buildClientList(knownClients)
  const initialClient = initial?.client ?? DEFAULT_CLIENTS[0]
  const isInitialKnown = clients.includes(initialClient.toUpperCase())

  const [startTime, setStartTime] = useState(
    initial?.startedAt ? isoToTimeString(initial.startedAt) : '09:00',
  )
  const [endTime, setEndTime] = useState(
    initial?.endedAt ? isoToTimeString(initial.endedAt) : '10:00',
  )
  const [note, setNote] = useState(initial?.note ?? '')
  const [ticket, setTicket] = useState(initial?.ticket ?? '')
  const [client, setClient] = useState(
    isInitialKnown ? initialClient.toUpperCase() : OTHER_SENTINEL,
  )
  const [otherValue, setOtherValue] = useState(isInitialKnown ? '' : initialClient)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // the client field is a select plus an "Other" text input, so a pulled-in code
  //  has to land on whichever of the two can represent it
  const applyClient = (code: string) => {
    const upper = code.trim().toUpperCase()
    if (!upper) return
    if (clients.includes(upper)) {
      setClient(upper)
      setOtherValue('')
    } else {
      setClient(OTHER_SENTINEL)
      setOtherValue(upper)
    }
  }

  // keep the times in sync when the surrounding context changes underneath an
  //  already-open form; e.g. editing the day's last entry shifts the end time
  //  that this new entry should start from
  const initialStart = initial?.startedAt
  const initialEnd = initial?.endedAt
  useEffect(() => {
    if (initialStart) setStartTime(isoToTimeString(initialStart))
  }, [initialStart])
  useEffect(() => {
    if (initialEnd) setEndTime(isoToTimeString(initialEnd))
  }, [initialEnd])

  const startIso = timeStringToIso(date, startTime)
  const endIso = timeStringToIso(date, endTime)
  const roundedStart = floorQuarter(startIso)
  const roundedEnd = ceilQuarter(endIso)
  const startRounded = roundedStart !== startIso
  const endRounded = roundedEnd !== endIso

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const finalClient = client === OTHER_SENTINEL ? otherValue.trim().toUpperCase() : client
    if (!finalClient) {
      setError('Client is required')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        startedAt: startIso,
        endedAt: endIso,
        note: note.trim(),
        ticket: normalizeTicketField(ticket),
        client: finalClient,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const submitViaRef = () => formRef.current?.requestSubmit()

  return (
    <form ref={formRef} className="entry-form" onSubmit={handleSubmit}>
      <div className="time-field">
        <label>Start</label>
        <TimeInput value={startTime} onChange={setStartTime} required />
        <span className="rounded-preview">
          {startRounded ? `→ ${isoToTimeString(roundedStart)}` : ''}
        </span>
      </div>
      <div className="time-field">
        <label>End</label>
        <TimeInput value={endTime} onChange={setEndTime} required autoFocus />
        <span className="rounded-preview">
          {endRounded ? `→ ${isoToTimeString(roundedEnd)}` : ''}
        </span>
      </div>
      <div className="note-field">
        <label>Note</label>
        <AutocompleteInput
          value={note}
          onChange={setNote}
          // repeating a task should bring its ticket and client along
          onAccept={(s) => {
            setNote(s.value)
            setTicket(s.ticket)
            applyClient(s.client)
          }}
          suggestions={noteSuggestions}
          placeholder="What did you work on?"
          onEnter={submitViaRef}
        />
      </div>
      <div className="ticket-field">
        <label>Ticket</label>
        <AutocompleteInput
          value={ticket}
          onChange={setTicket}
          // the note is left alone here — it's free text the user likely wrote
          //  deliberately, unlike the short codes
          onAccept={(s) => {
            setTicket(s.value)
            applyClient(s.client)
          }}
          suggestions={ticketSuggestions}
          placeholder="Optional"
          className="ticket-input"
          onEnter={submitViaRef}
        />
      </div>
      <div className="client-field">
        <label>Client</label>
        <div className="client-select-row">
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitViaRef()
              }
            }}
          >
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value={OTHER_SENTINEL}>Other…</option>
          </select>
          {client === OTHER_SENTINEL && (
            <input
              type="text"
              value={otherValue}
              onChange={(e) => setOtherValue(e.target.value)}
              placeholder="Code"
              className="client-other-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitViaRef()
                }
              }}
            />
          )}
        </div>
      </div>
      <div className="actions-field">
        <label aria-hidden="true">&nbsp;</label>
        <div className="actions-row">
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
    </form>
  )
}
