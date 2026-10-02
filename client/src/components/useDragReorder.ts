// client/src/components/useDragReorder.ts

import { useState } from 'react'

// moves one id to where another sits, shifting the rest along
export const moveId = (ids: number[], id: number, targetId: number): number[] => {
  const from = ids.indexOf(id)
  const to = ids.indexOf(targetId)
  if (from === -1 || to === -1 || from === to) return ids
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

// drag-to-reorder for table rows by a handle. rows follow the pointer live
//  while dragging, and the new order is committed once, on drop. the handle
//  also takes ArrowUp/ArrowDown so reordering doesn't need a mouse
export const useDragReorder = (
  ids: number[],
  enabled: boolean,
  onCommit: (ids: number[]) => void,
) => {
  const [dragging, setDragging] = useState<number | null>(null)
  const [live, setLive] = useState<number[] | null>(null)
  const order = live ?? ids

  const finish = () => {
    if (live && live.join() !== ids.join()) onCommit(live)
    setDragging(null)
    setLive(null)
  }

  const handleProps = (id: number) => ({
    draggable: enabled,
    disabled: !enabled,
    onDragStart: (e: React.DragEvent<HTMLElement>) => {
      setDragging(id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(id))
      // drag the whole row's image, not just the handle
      const row = e.currentTarget.closest('tr')
      if (row) e.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2)
    },
    onDragEnd: finish,
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (!enabled || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
      e.preventDefault()
      const i = ids.indexOf(id)
      const target = ids[e.key === 'ArrowUp' ? i - 1 : i + 1]
      if (target !== undefined) onCommit(moveId(ids, id, target))
    },
  })

  const rowProps = (id: number) => ({
    className: dragging === id ? 'dragging' : undefined,
    onDragOver: (e: React.DragEvent<HTMLElement>) => {
      if (dragging === null) return
      e.preventDefault()
      if (id !== dragging) setLive((prev) => moveId(prev ?? ids, dragging, id))
    },
    onDrop: (e: React.DragEvent<HTMLElement>) => e.preventDefault(),
  })

  return { order, handleProps, rowProps }
}
