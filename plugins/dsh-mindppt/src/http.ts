import type { MindPptWorkspaceController } from './controller.ts'
import { DOCUMENT_ROUTE, type MindPptFileIdentity } from './shared.ts'

interface ConnectionFetch {
  register(route: {
    path: string
    methods: readonly ('GET' | 'POST')[]
    requestBody: 'buffered'
    fetch(request: Request): Promise<Response>
  }): () => Promise<void>
}

type DocumentRequest =
  | { action: 'select'; identity: MindPptFileIdentity }
  | { action: 'clear'; sessionId: string; path?: string }
  | { action: 'write'; identity: MindPptFileIdentity; source: string }

export function registerDocumentRoute(
  connection: ConnectionFetch,
  controller: MindPptWorkspaceController,
): () => Promise<void> {
  return connection.register({
    path: DOCUMENT_ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      try {
        const payload = await request.json() as DocumentRequest
        if (payload.action === 'clear') {
          controller.clear(payload.sessionId, payload.path)
          return json({ ok: true })
        }
        if (payload.action === 'select') {
          await controller.select(payload.identity, request.signal)
          return json({ ok: true, inspection: controller.inspect(payload.identity.sessionId) })
        }
        if (payload.action === 'write') {
          const inspection = await controller.replaceSource(
            payload.identity,
            payload.source,
            request.signal,
          )
          return json({ ok: true, inspection })
        }
        return new Response('Unknown MindPPT action', { status: 400 })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return json({ ok: false, error: message }, 409)
      }
    },
  })
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}
