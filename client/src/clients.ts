// client/src/clients.ts

// PC and WB are the two standing clients; always offered even before any
//  entries exist for them
export const DEFAULT_CLIENTS = ['PC', 'WB']

// the canonical client option list: the standing defaults unioned with any
//  codes already seen on the server, upper-cased and sorted
export const buildClientList = (known: string[]): string[] => {
  const set = new Set<string>(DEFAULT_CLIENTS)
  for (const c of known) set.add(c.toUpperCase())
  return Array.from(set).sort()
}
