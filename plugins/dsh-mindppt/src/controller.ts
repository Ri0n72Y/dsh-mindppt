import { semanticProjection, type DocumentInspection } from './inspection.ts'
import { MindPptDocumentRuntime } from './runtime.ts'
import {
  applyGuardedPatch,
  type GuardedPatchInput,
  type MindPptFileIdentity,
} from './shared.ts'
import type { WorkspaceFilePort } from './workspace-file-port.ts'

export type { DocumentInspection } from './inspection.ts'
export type {
  WorkspaceFilePort,
  WorkspaceFileSnapshot,
} from './workspace-file-port.ts'

interface ActiveDocument {
  identity: MindPptFileIdentity
  runtime: MindPptDocumentRuntime
}

interface PendingSelection {
  generation: number
  path: string
}

export class MindPptWorkspaceController {
  private readonly active = new Map<string, ActiveDocument>()
  private readonly selectionGeneration = new Map<string, number>()
  private readonly pendingSelection = new Map<string, PendingSelection>()

  constructor(private readonly files: WorkspaceFilePort) {}

  async select(identity: MindPptFileIdentity, signal?: AbortSignal): Promise<void> {
    const generation = this.nextSelection(identity.sessionId)
    if (!identity.path.toLowerCase().endsWith('.mindppt')) {
      this.pendingSelection.delete(identity.sessionId)
      this.active.delete(identity.sessionId)
      return
    }
    this.pendingSelection.set(identity.sessionId, {
      generation,
      path: identity.path,
    })
    const source = await this.files.readText(identity, signal)
    if (!this.isLatestSelection(identity, generation)) return
    const previous = this.active.get(identity.sessionId)
    if (previous?.identity.path === identity.path) {
      previous.identity = identity
      previous.runtime.applySource(source)
      this.finishSelection(identity.sessionId, generation)
      return
    }
    const runtime = await MindPptDocumentRuntime.create(source)
    if (!this.isLatestSelection(identity, generation)) return
    this.active.set(identity.sessionId, { identity, runtime })
    this.finishSelection(identity.sessionId, generation)
  }

  clear(sessionId: string, path?: string): void {
    const current = this.active.get(sessionId)
    const pending = this.pendingSelection.get(sessionId)
    const clearsCurrent = current !== undefined
      && (path === undefined || current.identity.path === path)
    const clearsPending = pending !== undefined
      && (path === undefined || pending.path === path)
    if (!clearsCurrent && !clearsPending) return
    if (clearsPending) {
      this.nextSelection(sessionId)
      this.pendingSelection.delete(sessionId)
    }
    if (clearsCurrent) this.active.delete(sessionId)
  }

  async replaceSource(
    identity: MindPptFileIdentity,
    source: string,
    expectedVersion: string,
    signal?: AbortSignal,
  ): Promise<{ inspection: DocumentInspection; version: string }> {
    const current = this.requireCurrent(identity.sessionId)
    this.assertIdentity(current, identity)
    if (!expectedVersion) {
      throw new Error('MindPPT write requires a workspace file version')
    }
    const version = await this.files.writeText(
      identity,
      source,
      expectedVersion,
      signal,
    )
    current.runtime.applySource(source)
    return {
      inspection: this.inspect(identity.sessionId),
      version,
    }
  }

  async guardedPatch(
    sessionId: string,
    input: GuardedPatchInput,
    signal?: AbortSignal,
  ): Promise<{ ok: true; inspection: DocumentInspection } | { ok: false; reason: string }> {
    const current = this.requireCurrent(sessionId)
    const snapshot = await this.files.readSnapshot(current.identity, signal)
    const patched = applyGuardedPatch(snapshot.source, input)
    if (!patched.ok) return patched
    try {
      await this.files.writeText(
        current.identity,
        patched.source,
        snapshot.version,
        signal,
      )
    } catch (error) {
      if (isStaleWrite(error)) {
        return { ok: false, reason: 'stale patch: workspace file changed' }
      }
      throw error
    }
    current.runtime.applySource(patched.source)
    return { ok: true, inspection: this.inspect(sessionId) }
  }

  inspect(sessionId: string): DocumentInspection {
    const current = this.requireCurrent(sessionId)
    const view = current.runtime.view
    return {
      file: current.identity,
      source: view.source,
      diagnostics: view.diagnostics,
      structureCurrent: view.structureCurrent,
      semantic: view.structure ? semanticProjection(view.structure) : [],
      tree: view.structure?.tree ?? null,
      softLinks: view.structure?.links ?? [],
      presentationPaths: view.structure?.paths ?? [],
      activeExtensionRendererTypes: view.rendererTypes,
      structureBasis: view.structureCurrent
        ? 'current'
        : view.structure ? 'last-good' : 'none',
    }
  }

  attempts(sessionId: string): number {
    return this.requireCurrent(sessionId).runtime.attempts
  }

  private nextSelection(sessionId: string): number {
    const generation = (this.selectionGeneration.get(sessionId) ?? 0) + 1
    this.selectionGeneration.set(sessionId, generation)
    return generation
  }

  private isLatestSelection(
    identity: MindPptFileIdentity,
    generation: number,
  ): boolean {
    const pending = this.pendingSelection.get(identity.sessionId)
    return this.selectionGeneration.get(identity.sessionId) === generation
      && pending?.generation === generation
      && pending.path === identity.path
  }

  private finishSelection(sessionId: string, generation: number): void {
    if (this.pendingSelection.get(sessionId)?.generation === generation) {
      this.pendingSelection.delete(sessionId)
    }
  }

  private requireCurrent(sessionId: string): ActiveDocument {
    const current = this.active.get(sessionId)
    if (!current) {
      throw new Error('no selected MindPPT document for this session')
    }
    return current
  }

  private assertIdentity(
    current: ActiveDocument,
    identity: MindPptFileIdentity,
  ): void {
    if (current.identity.path !== identity.path) {
      throw new Error('stale MindPPT document selection')
    }
  }
}

function isStaleWrite(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'FS_STALE_VERSION'
}
