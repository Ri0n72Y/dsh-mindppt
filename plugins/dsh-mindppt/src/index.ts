import type { Context } from '@deepseek-ai/cordis'
import { MindPptWorkspaceController } from './controller.ts'
import { workspaceFilePort } from './fs-port.ts'
import { registerDocumentRoute } from './http.ts'
import { registerMindPptTools } from './agent-tools.ts'
import { registerMindPptSkill } from './skill-provider.ts'

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
export const inject = ['connection', 'fs', 'sessions', 'tools', 'skills']

interface HostContext extends Context {
  connection: {
    fetch: Parameters<typeof registerDocumentRoute>[0]
  }
  fs: Parameters<typeof workspaceFilePort>[0]
  sessions: Parameters<typeof workspaceFilePort>[1]
  tools: Parameters<typeof registerMindPptTools>[0]
  skills: Parameters<typeof registerMindPptSkill>[0]
}

interface FileObservationContext {
  emit(
    event: 'fs/observed',
    target: unknown,
    observation: { kind: 'present'; version: string },
    actor: undefined,
  ): void
}

export function apply(ctx: Context): void {
  const host = ctx as HostContext
  const observed = ctx as unknown as FileObservationContext
  const files = workspaceFilePort(
    host.fs,
    host.sessions,
    (target, version) => {
      observed.emit('fs/observed', target, { kind: 'present', version }, undefined)
    },
  )
  const controller = new MindPptWorkspaceController(files)
  registerMindPptSkill(host.skills)
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
