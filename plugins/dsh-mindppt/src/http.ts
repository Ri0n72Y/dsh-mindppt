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
  | { action: 'select'; identity: MindPptFileIdentity; selectionId: string }
  | { action: 'clear'; sessionId: string; path?: string; selectionId?: string }
  | {
    action: 'write'
    identity: MindPptFileIdentity
    source: string
    expectedVersion: string
  }

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
          await controller.clear(
            payload.sessionId,
            payload.path,
            payload.selectionId,
          )
          return json({ ok: true })
        }
        if (payload.action === 'select') {
          await controller.select(
            payload.identity,
            request.signal,
            payload.selectionId,
          )
          return json({
            ok: true,
            inspection: controller.inspect(payload.identity.sessionId),
          })
        }
        if (payload.action === 'write') {
          const result = await controller.writeWorkspaceSource(
            payload.identity,
            payload.source,
            payload.expectedVersion,
            request.signal,
          )
          return json({ ok: true, ...result })
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
