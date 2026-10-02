// client/src/components/TaskCopyOverlay.tsx

import { decimalHours, taskCopyRow, taskListString, ticketListString } from '../tasks'
import { clientBadgeClass } from './EntryRow'
import { useCopyPopover } from './useCopyPopover'

type Props = {
  client: string
  chipKey: string
  minutes: number
  tickets: string[]
  tasks: string[]
  // the client-and-project label, e.g. 'PortCity Logistics - Dispatch Intelligence Platform II'
  project: string
  anchor: DOMRect
  onClose: () => void
}

export const TaskCopyOverlay = ({
  client,
  chipKey,
  minutes,
  tickets,
  tasks,
  project,
  anchor,
  onClose,
}: Props) => {
  const { copied, closing, copy, fadeStyle } = useCopyPopover(chipKey, onClose)

  // anchor the popover just below the day header, right edge aligned with the
  //  day's task list (header right edge, less the day-body's 16px right padding)
  const style: React.CSSProperties = {
    top: anchor.bottom,
    right: window.innerWidth - anchor.right + 16,
    ...fadeStyle,
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
            <th>Project</th>
            <th>Copy</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="copy-hrs">{decimalHours(minutes)}</td>
            <td className="copy-tasks">{taskListString(tasks) || <em>—</em>}</td>
            <td className="copy-tickets">{ticketListString(tickets) || <em>—</em>}</td>
            <td className="copy-projects">{project || <em>—</em>}</td>
            <td className="copy-glyph-cell">
              <button
                className="ghost copy-glyph"
                onClick={() => copy(taskCopyRow(minutes, tasks, tickets, project))}
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
