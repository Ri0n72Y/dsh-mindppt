import { DOCUMENT_BROWSER_ROUTE, type MindPptFileIdentity } from '../shared.ts'

export type DocumentWireRequest =
  | { action: 'select'; identity: MindPptFileIdentity }
  | { action: 'clear'; sessionId: string; path?: string }
  | { action: 'write'; identity: MindPptFileIdentity; source: string }

export async function postDocument(
  payload: DocumentWireRequest,
): Promise<void> {
  const response = await fetch(DOCUMENT_BROWSER_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (response.ok) return
  const text = await response.text()
  throw new Error(text || 'MindPPT workspace write failed')
}
