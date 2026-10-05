import { describe, expect, it } from 'vitest'
import { applyGuardedPatch, parseSessionFileAddress } from '../src/shared.ts'

describe('guarded patch', () => {
  it('replaces and deletes exact non-empty spans', () => {
    expect(applyGuardedPatch('abc', {
      start: 1, end: 2, expected: 'b', replacement: 'B',
    })).toEqual({ ok: true, source: 'aBc' })
    expect(applyGuardedPatch('abc', {
      start: 1, end: 2, expected: 'b', replacement: '',
    })).toEqual({ ok: true, source: 'ac' })
  })

  it.each([
    [-1, 1, 'a'],
    [1.5, 2, 'b'],
    [1, 1, ''],
    [0, 4, 'abc'],
    [0, 1, 'x'],
  ])('rejects invalid or stale range %s..%s', (start, end, expected) => {
    expect(applyGuardedPatch('abc', {
      start, end, expected, replacement: 'x',
    }).ok).toBe(false)
  })
})

it('decodes DSH rc2 session file addresses', () => {
  expect(parseSessionFileAddress(
    'dsh-resource://file/session/s1/docs/a%20b.mindppt',
  )).toEqual({ sessionId: 's1', path: 'docs/a b.mindppt' })
})
