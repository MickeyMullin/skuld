// client/src/components/AutocompleteInput.tsx

import { useEffect, useRef, useState } from 'react'
import type { Suggestion } from '../suggestions'

type Props = {
  value: string
  onChange: (value: string) => void
  onAccept: (suggestion: Suggestion) => void
  suggestions: Suggestion[]
  placeholder?: string
  className?: string
  onEnter?: () => void
}

// case-insensitive prefix matches, minus anything the user has already typed in
//  full — there's nothing left to complete there
const matchesFor = (value: string, suggestions: Suggestion[]): Suggestion[] => {
  const query = value.trim().toLowerCase()
  if (!query) return []
  return suggestions.filter((s) => {
    const lower = s.value.toLowerCase()
    return lower.startsWith(query) && lower !== query
  })
}

export const AutocompleteInput = ({
  value,
  onChange,
  onAccept,
  suggestions,
  placeholder,
  className,
  onEnter,
}: Props) => {
  const [open, setOpen] = useState(false)
  // null means the caret is still in the input and the user hasn't stepped into
  //  the list; an index means they have, which is what arms Enter
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const matches = open ? matchesFor(value, suggestions) : []
  // Tab always takes the stepped-into row if there is one, else the first match
  const tabTarget = activeIndex ?? 0

  // the enclosing .day card clips its overflow, so the list is positioned fixed
  //  against the input's on-screen box rather than flowing inside the card
  const rect = inputRef.current?.getBoundingClientRect()
  const listStyle: React.CSSProperties | undefined = rect
    ? { top: rect.bottom + 4, left: rect.left, minWidth: rect.width }
    : undefined

  // drop back out of the list if it shrinks past where the user was standing
  useEffect(() => {
    if (activeIndex !== null && activeIndex >= matches.length) setActiveIndex(null)
  }, [matches.length, activeIndex])

  // keep the stepped-into row visible once the list is long enough to scroll
  useEffect(() => {
    if (activeIndex === null) return
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const accept = (index: number) => {
    const match = matches[index]
    if (!match) return
    onAccept(match)
    setOpen(false)
    setActiveIndex(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) {
      if (e.key === 'Enter') {
        e.preventDefault()
        onEnter?.()
      }
      return
    }

    if (e.key === 'Tab') {
      // take the suggestion; the un-prevented Tab still advances to the next field
      accept(tabTarget)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((a) => (a === null ? 0 : Math.min(a + 1, matches.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      // stepping up off the first row returns to the input, where the arrow key
      //  should go back to moving the caret
      if (activeIndex === null) return
      e.preventDefault()
      setActiveIndex((a) => (a === null || a === 0 ? null : a - 1))
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setActiveIndex(null)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Enter only accepts once the user has stepped into the list; otherwise it
      //  submits, so a note that merely happens to prefix an old one still saves
      if (activeIndex !== null) accept(activeIndex)
      else {
        setOpen(false)
        onEnter?.()
      }
    }
  }

  return (
    <div className="autocomplete">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActiveIndex(null)
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
      />
      {matches.length > 0 && (
        <ul className="autocomplete-list" style={listStyle} ref={listRef}>
          {matches.map((m, i) => (
            <li key={m.value}>
              <button
                type="button"
                className={`autocomplete-option${i === tabTarget ? ' tab-target' : ''}${
                  i === activeIndex ? ' active' : ''
                }`}
                // mousedown, so the input never blurs out from under the click
                onMouseDown={(e) => {
                  e.preventDefault()
                  accept(i)
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="autocomplete-value">{m.value}</span>
                {m.ticket && <span className="autocomplete-meta">{m.ticket}</span>}
                <span className="autocomplete-meta">{m.client}</span>
                {i === tabTarget && <span className="autocomplete-tab-hint">⇥</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
