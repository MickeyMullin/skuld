// client/src/tasks.test.ts

import { describe, expect, test } from 'bun:test'
import { buildProjectNames, taskCopyRow } from './tasks'

describe('taskCopyRow', () => {
  test('appends the project after the ticket column', () => {
    expect(
      taskCopyRow(435, ['Standup', 'Code-change handling'], ['RES-233', 'RES-250'],
        'PortCity Logistics - Dispatch Intelligence Platform II',
      ),
    ).toBe(
      '7.25\tStandup, Code-change handling\t\t\tRES-233, RES-250\tPortCity Logistics - Dispatch Intelligence Platform II',
    )
  })

  test('keeps the project cell even when empty, so pasted rows line up', () => {
    expect(taskCopyRow(60, ['Standup'], [], '')).toBe('1.00\tStandup\t\t\t\t')
  })

  test('takes an alternate hours format', () => {
    expect(taskCopyRow(90, [], [], 'WB', (m) => String(m / 60))).toBe('1.5\t\t\t\t\tWB')
  })
})

describe('buildProjectNames', () => {
  test('dedupes and drops blanks', () => {
    expect(buildProjectNames(['B', '', 'a', 'b'])).toEqual(['a', 'B'])
  })
})
