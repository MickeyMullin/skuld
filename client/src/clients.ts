// client/src/clients.ts

import type { Client } from './api'

// the codes offered in a client picker: active clients in their configured
//  order, plus the current value when it's inactive or not in the catalog, so
//  editing an older entry never silently drops its client
export const clientCodeOptions = (clients: Client[], current = ''): string[] => {
  const codes = clients.filter((c) => c.active).map((c) => c.code)
  const upper = current.trim().toUpperCase()
  return upper && !codes.includes(upper) ? [...codes, upper] : codes
}

// the name copy/export output uses for a client: its full name, or its code
//  when no name is set
export const clientLabel = (clients: Client[], code: string): string =>
  clients.find((c) => c.code === code)?.name.trim() || code

// sort key placing clients in their configured order, unknown codes last
export const clientRank = (clients: Client[], code: string): number => {
  const i = clients.findIndex((c) => c.code === code)
  return i === -1 ? clients.length : i
}
