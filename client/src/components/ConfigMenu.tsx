// client/src/components/ConfigMenu.tsx

import { useEffect, useRef, useState } from 'react'

type Props = {
  clients: string[]
  defaultClient: string | null
  onChangeDefault: (client: string) => void
  onClearDefault: () => void
}

export const ConfigMenu = ({
  clients,
  defaultClient,
  onChangeDefault,
  onClearDefault,
}: Props) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // dismiss on Escape or a click outside the menu
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div className="config-menu" ref={rootRef}>
      <button
        className="config-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Settings"
      >
        {'\u2699' /* gear (⚙) */}
      </button>
      {open && (
        <div className="config-popover" role="menu">
          <div className="config-section-label">Default client</div>
          <div className="config-client-list">
            {clients.map((c) => (
              <button
                key={c}
                type="button"
                role="menuitemradio"
                aria-checked={c === defaultClient}
                className={`config-client-option${c === defaultClient ? ' selected' : ''}`}
                onClick={() => onChangeDefault(c)}
              >
                <span className="config-check">{c === defaultClient ? '✓' : ''}</span>
                {c}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ghost config-clear"
            onClick={onClearDefault}
            disabled={!defaultClient}
          >
            Clear default
          </button>
        </div>
      )}
    </div>
  )
}
