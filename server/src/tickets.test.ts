// server/src/tickets.test.ts

import { describe, expect, test } from 'bun:test'
import * as client from '../../client/src/tasks'
import { buildTicketList, splitTickets } from './tickets'

// the summary's ticket lists have to match what the day-copy dialog shows
const SAMPLES = [
  '',
  'RES-1113',
  'RES-1113, 2280',
  '223,224',
  '223, 224,225',
  ',223,,224,',
  '  RES-1 ,  res-1 ',
]

describe('server ticket rules match the client', () => {
  test('splitTickets', () => {
    for (const raw of SAMPLES) expect(splitTickets(raw)).toEqual(client.splitTickets(raw))
  })

  test('buildTicketList', () => {
    expect(buildTicketList(SAMPLES)).toEqual(client.buildTicketList(SAMPLES))
    expect(buildTicketList(['b, A', 'a', 'C'])).toEqual(['A', 'b', 'C'])
  })
})
