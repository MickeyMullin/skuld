// client/src/clients.test.ts

import { describe, expect, test } from 'bun:test'
import type { Client } from './api'
import { clientCodeOptions, clientLabel } from './clients'

const clients: Client[] = [
  { id: 2, code: 'WB', name: 'Willow Bridge Properties', active: true, ordinal: 0 },
  { id: 1, code: 'PC', name: ' ', active: true, ordinal: 1 },
  { id: 3, code: 'RS', name: 'Old', active: false, ordinal: 2 },
]

describe('clientCodeOptions', () => {
  test('lists active clients in configured order', () => {
    expect(clientCodeOptions(clients)).toEqual(['WB', 'PC'])
  })

  test('keeps an inactive or unknown current client', () => {
    expect(clientCodeOptions(clients, 'rs')).toEqual(['WB', 'PC', 'RS'])
    expect(clientCodeOptions(clients, 'PC')).toEqual(['WB', 'PC'])
  })
})

describe('clientLabel', () => {
  test('uses the name, falling back to the code', () => {
    expect(clientLabel(clients, 'WB')).toBe('Willow Bridge Properties')
    expect(clientLabel(clients, 'PC')).toBe('PC')
    expect(clientLabel(clients, 'ZZ')).toBe('ZZ')
  })
})
