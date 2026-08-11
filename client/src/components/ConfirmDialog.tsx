// client/src/components/ConfirmDialog.tsx

import { useEffect, useRef, useState } from 'react'

type Props = {
  title: string
  confirmLabel: string
  busyLabel?: string
  // caveat shown below the summary box, e.g. that the action is irreversible
  note?: string
  onConfirm: () => Promise<void> | void
  onCancel: () => void
  children?: React.ReactNode
}

export const ConfirmDialog = ({
  title,
  confirmLabel,
  busyLabel = 'Working…',
  note,
  onConfirm,
  onCancel,
  children,
}: Props) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // focus the confirm button so the whole thing is one keystroke away, while
  //  still taking a deliberate act — Escape and the backdrop both back out
  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const handleConfirm = async () => {
    setError(null)
    setBusy(true)
    try {
      await onConfirm()
      // on success the caller unmounts this, so there's nothing to reset
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && onCancel()}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">{title}</h2>
        {children && <div className="modal-body">{children}</div>}
        {note && <p className="modal-note">{note}</p>}
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="danger"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
