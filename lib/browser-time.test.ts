import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { describe, expect, it } from 'vitest'
import { pogPlayerIds } from './session-rules'

// A fresh process gives each browser-zone simulation its own Date and Intl.
function inZone(zone: string, code: string) {
  const time = transformSync(readFileSync(new URL('./browser-time.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  const activity = transformSync(readFileSync(new URL('./player-activity.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  return JSON.parse(execFileSync(process.execPath, ['-e', `const time = (() => { const module = {exports:{}}; ${time}; return module.exports })(); const activity = (() => { const module = {exports:{}}; ${activity}; return module.exports })(); console.log(JSON.stringify(${code}));`], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }))
}
describe('browser timezone policy', () => {
  it.each([
    ['Asia/Shanghai', '2026-09-08', '2026-09-08T00:30:00'],
    ['America/Los_Angeles', '2026-09-07', '2026-09-07T09:30:00'],
    ['UTC', '2026-09-07', '2026-09-07T16:30:00'],
  ])('uses %s for local dates and editable instants', (zone, date, input) => {
    expect(inZone(zone, `[time.localDate(new Date('2026-09-07T16:30:00Z')), time.toDateTimeLocal('2026-09-07T16:30:00Z'), time.toIsoTimestamp('${input}')]`))
      .toEqual([date, input, '2026-09-07T16:30:00.000Z'])
  })
  it('uses browser local midnight when ordering imported history against real instants', () => {
    const expression = `activity.orderPlayersByRecentParticipation([
      {id:'import',created_at:'2026-01-01',recent_activity:{latest_import_date:'2026-09-08',latest_started_at:null,joined_at:'2026-01-01'}},
      {id:'live',created_at:'2026-01-01',recent_activity:{latest_import_date:null,latest_started_at:'2026-09-07T20:00:00Z',joined_at:'2026-01-01'}}
    ]).map(player=>player.id)`
    expect(inZone('Asia/Shanghai', expression)).toEqual(['live', 'import'])
    expect(inZone('America/Los_Angeles', expression)).toEqual(['import', 'live'])
  })
  it('applies DST to local event input', () => {
    expect(inZone('America/New_York', `[time.toIsoTimestamp('2026-01-15T12:00:00'),time.toIsoTimestamp('2026-07-15T12:00:00')]`))
      .toEqual(['2026-01-15T17:00:00.000Z', '2026-07-15T16:00:00.000Z'])
  })
})

it('uses one POG policy for ties, empty sessions and reordered input', () => {
  const entries = [{ player_id: 'b', chips: 100 }, { player_id: 'c', chips: -200 }, { player_id: 'a', chips: 100 }]
  expect(pogPlayerIds(entries)).toEqual(['a', 'b'])
  expect(pogPlayerIds([...entries].reverse())).toEqual(['a', 'b'])
  expect(pogPlayerIds([])).toEqual([])
})

it.each([
  ['Asia/Shanghai', '2026-09-08 00:30'],
  ['America/Los_Angeles', '2026-09-07 09:30'],
  ['UTC', '2026-09-07 16:30'],
])('displays yyyy-MM-dd HH:mm in %s', (zone, expected) => {
  expect(inZone(zone, "time.localDateTime('2026-09-07T16:30:00Z')")).toBe(expected)
})
