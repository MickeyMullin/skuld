// client/src/components/TaskCopyOverlay.tsx

import { useEffect, useState } from 'react'
import { decimalHours, taskCopyRow, taskListString } from '../tasks'
import { clientBadgeClass } from './EntryRow'

type Props = {
  client: string
  minutes: number
  tasks: string[]
  anchor: DOMRect
  onClose: () => void
}

export const TaskCopyOverlay = ({ client, minutes, tasks, anchor, onClose }: Props) => {
  const [copied, setCopied] = useState(false)

  // anchor the popover just below the day header, right edge aligned with the
  //  day's task list (header right edge, less the day-body's 16px right padding)
  const style: React.CSSProperties = {
    top: anchor.bottom,
    right: window.innerWidth - anchor.right + 16,
  }

  // dismiss on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // clear the copied flash
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(taskCopyRow(minutes, tasks))
    setCopied(true)
  }

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="copy-overlay" style={style} onClick={(e) => e.stopPropagation()}>
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
              <th>Copy</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="copy-hrs">{decimalHours(minutes)}</td>
              <td className="copy-tasks">{taskListString(tasks) || <em>—</em>}</td>
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
    </div>
  )
}
