// client/src/tasks.ts

// build the deduped task list for a client's day: drop blanks, dedupe
//  case-insensitively (keeping first-seen casing), lead with Standup if
//  present, then alphabetize the rest case-insensitively
export const buildTaskList = (notes: string[]): string[] => {
  const seen = new Map<string, string>()
  for (const raw of notes) {
    const task = raw.trim()
    if (!task) continue
    const key = task.toLowerCase()
    if (!seen.has(key)) seen.set(key, task)
  }

  let standup: string | undefined
  const rest: string[] = []
  for (const [key, display] of seen) {
    if (key === 'standup') standup = 'Standup'
    else rest.push(display)
  }
  rest.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  return standup ? [standup, ...rest] : rest
}

// comma-separated rendering of the task list
export const taskListString = (tasks: string[]): string => tasks.join(', ')

// minutes as 2-decimal hours, e.g. 75 -> "1.25" (for copying to another system)
export const decimalHours = (minutes: number): string => (minutes / 60).toFixed(2)

// tab-separated row for the clipboard, e.g. "1.25\tStandup, Planning"
export const taskCopyRow = (minutes: number, tasks: string[]): string =>
  `${decimalHours(minutes)}\t${taskListString(tasks)}`
