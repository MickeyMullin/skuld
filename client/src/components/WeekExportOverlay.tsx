// client/src/components/WeekExportOverlay.tsx

import { Fragment } from 'react'
import { taskListString, ticketListString } from '../tasks'
import { compactHours, weekExportText, type WeekExportDay } from '../weekExport'
import { clientBadgeClass } from './EntryRow'
import { useCopyPopover } from './useCopyPopover'

export const WEEK_EXPORT_KEY = 'week-export'

type Props = {
  week: WeekExportDay[]
  anchor: DOMRect
  onClose: () => void
}

// the whole week as one clipboard block: the day-copy row for every client on
//  every day, dated, with blank days kept so the paste covers all seven
export const WeekExportOverlay = ({ week, anchor, onClose }: Props) => {
  const { copied, closing, copy, fadeStyle } = useCopyPopover(WEEK_EXPORT_KEY, onClose)

  // just below the Export button, right edge aligned with the summary card, so
  //  the wider table opens leftward over the day list
  const style: React.CSSProperties = {
    top: anchor.bottom + 6,
    right: window.innerWidth - anchor.right,
    ...fadeStyle,
  }

  return (
    <div className={`copy-overlay week-export${closing ? ' closing' : ''}`} style={style}>
      <div className="copy-overlay-head">
        <span className="copy-overlay-title">Week export</span>
        <span className="copy-overlay-actions">
          <button
            className="ghost copy-glyph"
            onClick={() => copy(weekExportText(week))}
            title="Copy to clipboard"
          >
            {copied ? '✓' : '⎘'}
          </button>
          <button className="ghost" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </span>
      </div>
      <table className="copy-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Hrs</th>
            <th>Tasks</th>
            <th>Tickets</th>
            <th>Project</th>
          </tr>
        </thead>
        <tbody>
          {week.map((day) => (
            <Fragment key={day.date}>
              {day.rows.length === 0 && (
                <tr className="week-export-blank">
                  <td className="copy-date">{day.date}</td>
                  <td colSpan={4} />
                </tr>
              )}
              {day.rows.map((r, i) => (
                <tr key={r.client} className={i === 0 ? 'week-export-day-start' : undefined}>
                  <td className="copy-date">{day.date}</td>
                  <td className="copy-hrs">
                    {compactHours(r.minutes)}{' '}
                    <span className={clientBadgeClass(r.client)}>{r.client}</span>
                  </td>
                  <td className="copy-tasks">{taskListString(r.tasks) || <em>—</em>}</td>
                  <td className="copy-tickets">{ticketListString(r.tickets) || <em>—</em>}</td>
                  <td className="copy-projects">{r.project}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
