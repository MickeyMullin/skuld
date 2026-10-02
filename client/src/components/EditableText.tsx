// client/src/components/EditableText.tsx

import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  // saves the new value; a rejection puts the field back to the saved value
  onCommit: (value: string) => Promise<void>
  placeholder?: string
  maxLength?: number
  className?: string
  transform?: (raw: string) => string
  ariaLabel: string
}

// a text cell that saves on blur or Enter rather than on every keystroke, and
//  backs out on Escape
export const EditableText = ({
  value,
  onCommit,
  placeholder,
  maxLength,
  className,
  transform = (raw) => raw,
  ariaLabel,
}: Props) => {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  // pick up saved changes, but never under the user's cursor
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(value)
  }, [value])

  const commit = () => {
    const next = draft.trim()
    if (next === value) {
      setDraft(value)
      return
    }
    onCommit(next).catch(() => setDraft(value))
  }

  return (
    <input
      ref={ref}
      type="text"
      value={draft}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(transform(e.target.value))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value)
          // let the blur see the restored value, not the abandoned edit
          requestAnimationFrame(() => ref.current?.blur())
        }
      }}
    />
  )
}
