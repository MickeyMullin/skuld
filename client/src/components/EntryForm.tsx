// client/src/components/EntryForm.tsx

import { useRef, useState } from 'react'
import {
  ceilQuarter,
  floorQuarter,
  isoToTimeString,
  timeStringToIso,
} from '../dates'
import { TimeInput } from './TimeInput'

type FormValues = {
  startedAt: string
  endedAt: string
  note: string
  client: string
}

type Props = {
  date: string
  knownClients: string[]
  initial?: Partial<FormValues>
  submitLabel: string
  onSubmit: (values: FormValues) => Promise<void>
  onCancel: () => void
}

const DEFAULT_CLIENTS = ['PC', 'WB']
const OTHER_SENTINEL = '__other__'

const buildClientList = (known: string[]): string[] => {
  const set = new Set<string>(DEFAULT_CLIENTS)
  for (const c of known) set.add(c.toUpperCase())
  return Array.from(set).sort()
}

export const EntryForm = ({
  date,
  knownClients,
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
  const [client, setClient] = useState(
    isInitialKnown ? initialClient.toUpperCase() : OTHER_SENTINEL,
  )
  const [otherValue, setOtherValue] = useState(isInitialKnown ? '' : initialClient)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

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
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you work on?"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitViaRef()
            }
          }}
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
      <div className="actions-row">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
    </form>
  )
}
