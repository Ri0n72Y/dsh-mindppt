import type { Context } from '@deepseek-ai/cordis'
import { MindPptWorkspaceController } from './controller.ts'
import { workspaceFilePort } from './fs-port.ts'
import { registerDocumentRoute } from './http.ts'
import { registerMindPptTools } from './agent-tools.ts'

export { MindPptWorkspaceController } from './controller.ts'
export { applyGuardedPatch, DSH_BASELINE } from './shared.ts'
export type {
  DocumentInspection,
  WorkspaceFilePort,
} from './controller.ts'
export type {
  GuardedPatchInput,
  GuardedPatchResult,
  MindPptFileIdentity,
} from './shared.ts'

export const name = 'dsh-mindppt'
export const inject = ['connection', 'fs', 'sessions', 'tools']

interface HostContext extends Context {
  connection: {
    fetch: Parameters<typeof registerDocumentRoute>[0]
  }
  fs: Parameters<typeof workspaceFilePort>[0]
  sessions: Parameters<typeof workspaceFilePort>[1]
  tools: Parameters<typeof registerMindPptTools>[0]
}

export function apply(ctx: Context): void {
  const host = ctx as HostContext
  const files = workspaceFilePort(host.fs, host.sessions)
  const controller = new MindPptWorkspaceController(files)
  ctx.effect(
    () => registerDocumentRoute(host.connection.fetch, controller),
    'dsh-mindppt: document route',
  )
  ctx.effect(function* () {
    for (const dispose of registerMindPptTools(host.tools, controller)) {
      yield dispose
    }
  }, 'dsh-mindppt: agent tools')
}
