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
import { buildProjectList, defaultProjectFor, projectsForClient } from '../projects'
import type { ClientProject } from '../api'
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
  knownClients: string[]
  knownProjects: ClientProject[]
  defaultProject: ClientProject | null
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
  knownProjects,
  defaultProject,
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
  const projectList = buildProjectList(knownProjects)
  // an existing entry keeps whatever project it has, including none; a new one
  //  starts on the configured default when that belongs to its client
  const initialProject =
    initial?.project ?? defaultProjectFor(defaultProject, initialClient)
  const initialProjectOptions = projectsForClient(projectList, initialClient)
  const isInitialProjectKnown =
    !initialProject || initialProjectOptions.includes(initialProject)

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
  const projectOptions = projectsForClient(projectList, effectiveClient)

  // projects belong to a client, so the project field is likewise a select plus
  //  an "Other" text input, and a pulled-in name lands on whichever fits
  const applyProject = (forClient: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed || projectsForClient(projectList, forClient).includes(trimmed)) {
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
    if (clients.includes(upper)) {
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
            onChange={(e) => changeClient(e.target.value)}
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
              onChange={(e) => {
                setOtherValue(e.target.value)
                // a picked project belonged to the code as it was typed before
                if (project !== OTHER_SENTINEL) setProject('')
              }}
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
            {projectOptions.map((p) => (
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
