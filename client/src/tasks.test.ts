// client/src/tasks.test.ts

import { describe, expect, test } from 'bun:test'
import { buildProjectNames, buildTaskList, taskCopyRow } from './tasks'

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

describe('buildTaskList', () => {
  test('leads with Standup and otherwise alphabetizes', () => {
    expect(buildTaskList(['Load board', 'standup', 'Billing', 'load board'])).toEqual([
      'Standup',
      'Billing',
      'Load board',
    ])
  })

  test("merges the day's review tasks into one, with ranges", () => {
    expect(
      buildTaskList([
        'Standup',
        'Dependabot sweep, Review PRs 871, 872, 917, 918, 919, 920, 921, 922, 923, 924',
        'Review PRs 884, 910, 911',
        'Review PR 924, Review-file cleanup',
        'Review PRs 925, 928, 930',
        'Review PRs 927, 930, Address review findings on PRs 925, 926, 929',
        'GPS refresh ETL fixes, PRs 925, 926, 928, 930',
      ]),
    ).toEqual([
      'Standup',
      'Address review findings on PRs 925–6, 929',
      'Dependabot sweep',
      'GPS refresh ETL fixes, PRs 925, 926, 928, 930',
      'Review PRs 871–2, 884, 910–11, 917–25, 927–8, 930',
      'Review-file cleanup',
    ])
  })

  test('merges address-findings tasks the same way, apart from reviews', () => {
    expect(
      buildTaskList([
        'Review PR 937, Address review findings on PR 938',
        'Review PRs 931, 934, Address review findings on PR 931',
        'Addressed review findings for PRs 932, 933',
      ]),
    ).toEqual([
      'Address review findings on PRs 931–3, 938',
      'Review PRs 931, 934, 937',
    ])
  })

  test('a lone address-findings PR stays singular', () => {
    expect(buildTaskList(['Address review findings on PR 938'])).toEqual([
      'Address review findings on PR 938',
    ])
  })

  test('reads ranges with shortened ends and writes the differing digits', () => {
    expect(buildTaskList(['Review PRs 723–25, 548–9', 'Reviewed PRs 938-941, 999, 1000–1001'])).toEqual([
      'Review PRs 548–9, 723–5, 938–41, 999–1001',
    ])
  })

  test('keeps both digits of a teen at the end of a range', () => {
    expect(buildTaskList(['Review PRs 910, 911, 1012, 1013, 1014, 18, 19'])).toEqual([
      'Review PRs 18–19, 910–11, 1012–14',
    ])
  })

  test('a lone PR, even reviewed twice, stays singular', () => {
    expect(buildTaskList(['Review PR 924', 'Review PRs 924'])).toEqual(['Review PR 924'])
  })

  test('keeps a note that breaks the pattern as typed', () => {
    expect(
      buildTaskList([
        'Review PR 924 prettier fix',
        'Review PRs 717, 720, 726 (stack)',
        'Review dependabot PRs 680–688',
        'Address review findings on PR 925 (lint only)',
        'Drizzle schema management review',
        'Hot loads not yet available, awaiting-availability counts (PR 908)',
      ]),
    ).toEqual([
      'Address review findings on PR 925 (lint only)',
      'Drizzle schema management review',
      'Hot loads not yet available, awaiting-availability counts (PR 908)',
      'Review dependabot PRs 680–688',
      'Review PR 924 prettier fix',
      'Review PRs 717, 720, 726 (stack)',
    ])
  })

  test('text on both sides of a review task stays as separate tasks', () => {
    expect(buildTaskList(['Billing, Review PRs 5, 6, Load board, Route retries'])).toEqual([
      'Billing',
      'Load board, Route retries',
      'Review PRs 5–6',
    ])
  })
})
