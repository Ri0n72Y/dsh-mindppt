export const DSH_BASELINE = '0.2.0-rc.2'
export const MINDPPT_BODY_ID = 'dsh-mindppt/document'
export const DOCUMENT_ROUTE = '/api/mindppt/document'
export const DOCUMENT_BROWSER_ROUTE = DOCUMENT_ROUTE.slice(1)

export interface MindPptFileIdentity {
  sessionId: string
  path: string
}

export interface GuardedPatchInput {
  start: number
  end: number
  expected: string
  replacement: string
}

export type GuardedPatchResult =
  | { ok: true; source: string }
  | { ok: false; reason: string }

export function parseSessionFileAddress(
  address: string,
): { sessionId: string; path: string } | undefined {
  const prefix = 'dsh-resource://file/session/'
  if (!address.startsWith(prefix)) return undefined
  const tail = address.slice(prefix.length).split(/[?#]/, 1)[0] ?? ''
  const [encodedId, ...segments] = tail.split('/')
  if (!encodedId || segments.length === 0) return undefined
  try {
    return {
      sessionId: decodeURIComponent(encodedId),
      path: segments.map(decodeURIComponent).join('/'),
    }
  } catch {
    return undefined
  }
}

export function applyGuardedPatch(
  source: string,
  input: GuardedPatchInput,
): GuardedPatchResult {
  const { start, end, expected, replacement } = input
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { ok: false, reason: 'start and end must be integers' }
  }
  if (start < 0 || start >= end || end > source.length) {
    return { ok: false, reason: 'invalid non-empty source range' }
  }
  if (source.slice(start, end) !== expected) {
    return { ok: false, reason: 'stale patch: expected text does not match' }
  }
  return {
    ok: true,
    source: source.slice(0, start) + replacement + source.slice(end),
  }
}
