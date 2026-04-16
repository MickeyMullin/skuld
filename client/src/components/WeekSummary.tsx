// client/src/components/WeekSummary.tsx

import type { Entry } from '../api'
import { formatDuration, minutesBetween } from '../dates'

type Props = {
  entries: Entry[]
}

const clientColorClass = (client: string): string => {
  const upper = client.toUpperCase()
  if (upper === 'PC') return 'client-pc'
  if (upper === 'WB') return 'client-wb'
  return 'client-other'
}

export const WeekSummary = ({ entries }: Props) => {
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
        <h3 className="summary-title">Week Total</h3>
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
    </aside>
  )
}
