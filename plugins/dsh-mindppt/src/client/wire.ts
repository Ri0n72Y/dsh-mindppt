import { DOCUMENT_BROWSER_ROUTE, type MindPptFileIdentity } from '../shared.ts'

type WriteDocumentRequest = {
  action: 'write'
  identity: MindPptFileIdentity
  source: string
  expectedVersion: string
}

export type DocumentWireRequest =
  | { action: 'select'; identity: MindPptFileIdentity; selectionId: string }
  | { action: 'clear'; sessionId: string; path?: string; selectionId?: string }
  | WriteDocumentRequest

export function postDocument(payload: WriteDocumentRequest): Promise<string>
export function postDocument(payload: DocumentWireRequest): Promise<string | undefined>
export async function postDocument(
  payload: DocumentWireRequest,
): Promise<string | undefined> {
  const response = await fetch(DOCUMENT_BROWSER_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'MindPPT workspace write failed')
  }
  if (payload.action !== 'write') return undefined
  const body = await response.json() as { version?: unknown }
  if (typeof body.version !== 'string' || body.version.length === 0) {
    throw new Error('MindPPT workspace write returned no version')
  }
  return body.version
}
