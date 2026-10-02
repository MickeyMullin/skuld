// client/src/components/useCopyPopover.ts

import { useEffect, useState } from 'react'

// how long the ✓ lingers after a copy before the popover starts dismissing
const AUTO_CLOSE_MS = 250
// fade duration; pushed to the element as an inline style so the CSS animation
//  and the unmount timer below can't drift apart
const FADE_MS = 220

// the dismissal behavior shared by the copy popovers: Escape, an outside click,
//  or a completed copy closes them. the trigger whose data-copy-key matches is
//  left alone, since it toggles the popover itself
export const useCopyPopover = (copyKey: string, onClose: () => void) => {
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)

  // dismiss on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // dismiss on any click outside. no backdrop to swallow the click, so clicking
  //  another trigger closes this and opens that one in a single click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('.copy-overlay')) return
      if (target.closest<HTMLElement>('[data-copy-key]')?.dataset.copyKey === copyKey) return
      onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [copyKey, onClose])

  // a copy is the last thing wanted from the popover, so once the text is on
  //  the clipboard it shows the ✓ briefly, then fades itself out and closes
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setClosing(true), AUTO_CLOSE_MS)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    if (!closing) return
    const t = setTimeout(onClose, FADE_MS)
    return () => clearTimeout(t)
  }, [closing, onClose])

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  const fadeStyle: React.CSSProperties = closing ? { animationDuration: `${FADE_MS}ms` } : {}

  return { copied, closing, copy, fadeStyle }
}
