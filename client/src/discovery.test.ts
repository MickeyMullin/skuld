// client/src/discovery.test.ts

import { describe, expect, test } from 'bun:test'
import { showDiscoveryLink } from './discovery'

describe('showDiscoveryLink', () => {
  test('live (non-dev) always shows the link, regardless of query', () => {
    expect(showDiscoveryLink('', false)).toBe(true)
    expect(showDiscoveryLink('?discovery=1', false)).toBe(true)
    expect(showDiscoveryLink('?discovery=0', false)).toBe(true)
  })

  test('dev hides the link by default', () => {
    expect(showDiscoveryLink('', true)).toBe(false)
  })

  test('dev shows the link only for exactly ?discovery=1', () => {
    expect(showDiscoveryLink('?discovery=1', true)).toBe(true)
  })

  test('dev keeps the link hidden for near-miss query params', () => {
    expect(showDiscoveryLink('?discovery=0', true)).toBe(false)
    expect(showDiscoveryLink('?discovery', true)).toBe(false)
    expect(showDiscoveryLink('?discovery=true', true)).toBe(false)
    expect(showDiscoveryLink('?discover=1', true)).toBe(false)
    expect(showDiscoveryLink('?Discovery=1', true)).toBe(false)
  })
})
