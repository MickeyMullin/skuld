// client/src/components/TaskCopyOverlay.tsx

import { useEffect, useState } from 'react'
import { decimalHours, taskCopyRow, taskListString, ticketListString } from '../tasks'
import { clientBadgeClass } from './EntryRow'

// how long the ✓ lingers after a copy before the popover starts dismissing
const AUTO_CLOSE_MS = 250
// fade duration; pushed to the element as an inline style so the CSS animation
//  and the unmount timer below can't drift apart
const FADE_MS = 220

type Props = {
  client: string
  chipKey: string
  minutes: number
  tickets: string[]
  tasks: string[]
  anchor: DOMRect
  onClose: () => void
}

export const TaskCopyOverlay = ({
  client,
  chipKey,
  minutes,
  tickets,
  tasks,
  anchor,
  onClose,
}: Props) => {
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)

  // anchor the popover just below the day header, right edge aligned with the
  //  day's task list (header right edge, less the day-body's 16px right padding)
  const style: React.CSSProperties = {
    top: anchor.bottom,
    right: window.innerWidth - anchor.right + 16,
    ...(closing ? { animationDuration: `${FADE_MS}ms` } : {}),
  }

  // dismiss on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // dismiss on any click outside. no backdrop to swallow the click, so clicking
  //  another day+client chip closes this and opens that one in a single click —
  //  our own chip is left alone, since it toggles this dialog itself
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('.copy-overlay')) return
      if (target.closest<HTMLElement>('.chip')?.dataset.copyKey === chipKey) return
      onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [chipKey, onClose])

  // a copy is the last thing wanted from this popover, so once the row is on the
  //  clipboard it shows the ✓ briefly, then fades itself out and closes
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setClosing(true), AUTO_CLOSE_MS)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    if (!closing) return
    const t = setTimeout(onClose, FADE_MS)
    return () => clearTimeout(t)
  }, [closing, onClose])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(taskCopyRow(minutes, tasks, tickets))
    setCopied(true)
  }

  return (
    <div className={`copy-overlay${closing ? ' closing' : ''}`} style={style}>
      <div className="copy-overlay-head">
        <span className={clientBadgeClass(client)}>{client}</span>
        <button className="ghost" onClick={onClose} title="Close (Esc)">
          ×
        </button>
      </div>
      <table className="copy-table">
        <thead>
          <tr>
            <th>Hrs</th>
            <th>Tasks</th>
            <th>Tickets</th>
            <th>Copy</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="copy-hrs">{decimalHours(minutes)}</td>
            <td className="copy-tasks">{taskListString(tasks) || <em>—</em>}</td>
            <td className="copy-tickets">{ticketListString(tickets) || <em>—</em>}</td>
            <td className="copy-glyph-cell">
              <button
                className="ghost copy-glyph"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? '✓' : '⎘'}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
