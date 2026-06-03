// client/src/components/TimeInput.tsx

import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string // HH:mm, 24h
  onChange: (value: string) => void
  required?: boolean
  autoFocus?: boolean
}

const parseHHMM = (s: string): { h: number; m: number } | null => {
  const match = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h > 23 || m > 59) return null
  return { h, m }
}

const toHHMM = (h: number, m: number): string =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

export const TimeInput = ({ value, onChange, required, autoFocus }: Props) => {
  const [raw, setRaw] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // reflect external value changes (e.g. the add form's start time shifting when
  //  the day's last entry is edited) — but never while the user is mid-edit
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setRaw(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nativeEvent = e.nativeEvent as InputEvent
    const isDeleting = nativeEvent.inputType?.startsWith('delete')

    let val = e.target.value.replace(/[^0-9:]/g, '')

    // auto-insert colon after exactly 2 digits when typing forward
    if (!isDeleting && /^\d{2}$/.test(val)) {
      val = val + ':'
    }

    // don't allow more than HH:mm (5 chars)
    if (val.length > 5) return

    setRaw(val)

    const parsed = parseHHMM(val)
    if (parsed) onChange(toHHMM(parsed.h, parsed.m))
  }

  const handleBlur = () => {
    const parsed = parseHHMM(raw)
    if (parsed) {
      const normalized = toHHMM(parsed.h, parsed.m)
      setRaw(normalized)
      onChange(normalized)
    } else {
      setRaw(value)
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={handleChange}
      onFocus={(e) => e.target.select()}
      onBlur={handleBlur}
      placeholder="HH:MM"
      maxLength={5}
      required={required}
      autoFocus={autoFocus}
      className="time-input"
    />
  )
}
