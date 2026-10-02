// client/src/components/EntryForm.tsx

import { useEffect, useRef, useState } from 'react'
import {
  ceilQuarter,
  floorQuarter,
  isoToTimeString,
  shiftTimeString,
  timeStringToIso,
} from '../dates'
import { TimeInput } from './TimeInput'
import { AutocompleteInput } from './AutocompleteInput'
import { clientCodeOptions } from '../clients'
import { defaultProjectFor, projectOptions } from '../projects'
import type { Client, ClientProject, Project } from '../api'
import type { Suggestion } from '../suggestions'
import { normalizeTicketField } from '../tasks'

type FormValues = {
  startedAt: string
  endedAt: string
  note: string
  ticket: string
  client: string
  project: string
}

type Props = {
  date: string
  clients: Client[]
  projects: Project[]
  defaultProject: ClientProject | null
  // HH:mm a new entry starts at when nothing earlier in the day sets it
  preferredStartTime: string
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
  clients,
  projects,
  defaultProject,
  preferredStartTime,
  noteSuggestions,
  ticketSuggestions,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) => {
  // without a default client a new entry starts with none picked, so choosing
  //  one is a deliberate act rather than accepting whichever sorts first
  const initialClient = (initial?.client ?? '').trim().toUpperCase()
  const isCatalogClient = (code: string) => clients.some((c) => c.code === code)
  const isCatalogProject = (forClient: string, name: string) =>
    projects.some((p) => p.client === forClient && p.name === name)
  const isInitialKnown = !initialClient || isCatalogClient(initialClient)
  // an existing entry keeps whatever project it has, including none; a new one
  //  starts on the configured default when that belongs to its client
  const initialProject =
    initial?.project ?? defaultProjectFor(defaultProject, initialClient)
  const isInitialProjectKnown =
    !initialProject || isCatalogProject(initialClient, initialProject)

  const [startTime, setStartTime] = useState(
    initial?.startedAt ? isoToTimeString(initial.startedAt) : preferredStartTime,
  )
  const [endTime, setEndTime] = useState(
    initial?.endedAt ? isoToTimeString(initial.endedAt) : shiftTimeString(preferredStartTime, 60),
  )
  const [note, setNote] = useState(initial?.note ?? '')
  const [ticket, setTicket] = useState(initial?.ticket ?? '')
  const [client, setClient] = useState(isInitialKnown ? initialClient : OTHER_SENTINEL)
  const [otherValue, setOtherValue] = useState(isInitialKnown ? '' : initialClient)
  const [project, setProject] = useState(
    isInitialProjectKnown ? initialProject : OTHER_SENTINEL,
  )
  const [otherProject, setOtherProject] = useState(
    isInitialProjectKnown ? '' : initialProject,
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const effectiveClient = client === OTHER_SENTINEL ? otherValue.trim().toUpperCase() : client
  // active entries in configured order, plus whatever is currently picked, so an
  //  older entry on an inactive client or project still shows its own
  const clientCodes = clientCodeOptions(clients, client === OTHER_SENTINEL ? '' : client)
  const projectNames = projectOptions(
    projects,
    effectiveClient,
    project === OTHER_SENTINEL ? '' : project,
  )

  // projects belong to a client, so the project field is likewise a select plus
  //  an "Other" text input, and a pulled-in name lands on whichever fits
  const applyProject = (forClient: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed || isCatalogProject(forClient, trimmed)) {
      setProject(trimmed)
      setOtherProject('')
    } else {
      setProject(OTHER_SENTINEL)
      setOtherProject(trimmed)
    }
  }

  // the client field is a select plus an "Other" text input, so a pulled-in code
  //  has to land on whichever of the two can represent it. the project is
  //  carried along with it, since one client's project means nothing to another
  const applyClient = (code: string, projectName: string) => {
    const upper = code.trim().toUpperCase()
    if (!upper) return
    if (isCatalogClient(upper)) {
      setClient(upper)
      setOtherValue('')
    } else {
      setClient(OTHER_SENTINEL)
      setOtherValue(upper)
    }
    applyProject(upper, projectName)
  }

  // picking a different client swaps in that client's default project, or none
  const changeClient = (value: string) => {
    setClient(value)
    if (value === OTHER_SENTINEL) {
      applyProject('', '')
    } else {
      applyProject(value, defaultProjectFor(defaultProject, value))
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
    const finalClient = effectiveClient
    const finalProject = project === OTHER_SENTINEL ? otherProject.trim() : project
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
        project: finalProject,
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
            applyClient(s.client, s.project)
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
            applyClient(s.client, s.project)
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
            required
            onChange={(e) => changeClient(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitViaRef()
              }
            }}
          >
            <option value="" disabled hidden>
              Select…
            </option>
            {clientCodes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value={OTHER_SENTINEL}>Other…</option>
          </select>
          {client === OTHER_SENTINEL && (
            <input
              type="text"
              value={otherValue}
              onChange={(e) => {
                setOtherValue(e.target.value)
                // a picked project belonged to the code as it was typed before
                if (project !== OTHER_SENTINEL) setProject('')
              }}
              placeholder="Code"
              maxLength={3}
              required
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
      <div className="project-field">
        <label>Project</label>
        <div className="client-select-row">
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitViaRef()
              }
            }}
          >
            <option value="">None</option>
            {projectNames.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value={OTHER_SENTINEL}>Other…</option>
          </select>
          {project === OTHER_SENTINEL && (
            <input
              type="text"
              value={otherProject}
              onChange={(e) => setOtherProject(e.target.value)}
              placeholder="Project"
              className="project-other-input"
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
