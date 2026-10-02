// client/src/components/WeekSummary.tsx

import { useCallback, useState } from 'react'
import type { Client, Entry } from '../api'
import { formatDuration, minutesBetween } from '../dates'
import { buildWeekExport } from '../weekExport'
import { WEEK_EXPORT_KEY, WeekExportOverlay } from './WeekExportOverlay'

type Props = {
  days: Date[]
  entries: Entry[]
  clients: Client[]
}

const clientColorClass = (client: string): string => {
  const upper = client.toUpperCase()
  if (upper === 'PC') return 'client-pc'
  if (upper === 'WB') return 'client-wb'
  return 'client-other'
}

export const WeekSummary = ({ days, entries, clients }: Props) => {
  const [exportAnchor, setExportAnchor] = useState<DOMRect | null>(null)
  const closeExport = useCallback(() => setExportAnchor(null), [])

  const perClient = new Map<string, number>()
  let total = 0
  for (const e of entries) {
    const mins = minutesBetween(e.startedAt, e.endedAt)
    total += mins
    perClient.set(e.client, (perClient.get(e.client) ?? 0) + mins)
  }
  const rows = Array.from(perClient.entries()).sort((a, b) => b[1] - a[1])
  const max = rows.length ? rows[0][1] : 0

  return (
    <aside className="week-summary">
      <div>
        <div className="summary-head">
          <h3 className="summary-title">Week Total</h3>
          <button
            type="button"
            className={`chip chip-export${exportAnchor ? ' chip-active' : ''}`}
            data-copy-key={WEEK_EXPORT_KEY}
            title="Export the week's tasks"
            onClick={(e) => {
              const box = e.currentTarget.closest('.week-summary')
              const button = e.currentTarget.getBoundingClientRect()
              const card = box?.getBoundingClientRect()
              // below the button, flush with the card's right edge
              setExportAnchor((prev) =>
                prev ? null : card ? new DOMRect(card.x, button.y, card.width, button.height) : button,
              )
            }}
          >
            Export
          </button>
        </div>
        <div className="summary-total">{formatDuration(total)}</div>
      </div>
      {rows.length > 0 && (
        <div className="client-breakdown">
          {rows.map(([code, mins]) => (
            <div key={code} className="client-row">
              <div className="client-row-header">
                <span className="client-row-code">{code}</span>
                <span className="client-row-hours">{formatDuration(mins)}</span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${clientColorClass(code)}`}
                  style={{ width: max > 0 ? `${(mins / max) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {exportAnchor && (
        <WeekExportOverlay
          week={buildWeekExport(days, entries, clients)}
          anchor={exportAnchor}
          onClose={closeExport}
        />
      )}
    </aside>
  )
}
