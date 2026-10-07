import { documentInspection, type DocumentInspection } from './inspection.ts'
import { MindPptDocumentRuntime } from './runtime.ts'
import { SelectionTracker } from './selection-state.ts'
import { SessionWriteQueue } from './session-write-queue.ts'
import {
  applyGuardedPatch,
  type GuardedPatchInput,
  type MindPptFileIdentity,
} from './shared.ts'
import { WorkspacePreCommitRejected, type WorkspaceFilePort } from './workspace-file-port.ts'
export type { DocumentInspection } from './inspection.ts'
export type { WorkspaceFilePort, WorkspaceFileSnapshot } from './workspace-file-port.ts'
interface ActiveDocument {
  identity: MindPptFileIdentity
  runtime: MindPptDocumentRuntime
  selectionId: string
}
export class MindPptWorkspaceController {
  private readonly active = new Map<string, ActiveDocument>()
  private readonly selections = new SelectionTracker()
  private readonly writes = new SessionWriteQueue()
  constructor(private readonly files: WorkspaceFilePort) {}
  async select(
    identity: MindPptFileIdentity,
    signal?: AbortSignal,
    selectionId = identity.path,
  ): Promise<void> {
    const sessionId = identity.sessionId
    const generation = this.selections.begin(
      sessionId, identity.path, selectionId, false,
    )
    if (!identity.path.toLowerCase().endsWith('.mindppt')) {
      this.selections.finish(sessionId, generation)
      this.active.delete(sessionId)
      return
    }
    try {
      const pendingWrite = this.writes.pending(sessionId)
      if (pendingWrite) await pendingWrite
      signal?.throwIfAborted()
      if (!this.isCurrentSelect(identity, generation, selectionId)) return
      const source = await this.files.readText(identity, signal)
      if (!this.isCurrentSelect(identity, generation, selectionId)) return
      const previous = this.active.get(sessionId)
      if (previous?.identity.path === identity.path) {
        previous.identity = identity
        previous.selectionId = selectionId
        previous.runtime.applySource(source)
      } else {
        const runtime = await MindPptDocumentRuntime.create(source)
        if (!this.isCurrentSelect(identity, generation, selectionId)) return
        this.active.set(sessionId, { identity, runtime, selectionId })
      }
      this.selections.finish(sessionId, generation)
    } catch (error) {
      if (this.selections.get(sessionId)?.generation === generation) this.active.delete(sessionId)
      this.selections.finish(sessionId, generation)
      throw error
    }
  }
  async clear(sessionId: string, path?: string, selectionId?: string): Promise<void> {
    const current = this.active.get(sessionId)
    const pending = this.selections.get(sessionId)
    if (
      pending
      && selectionId !== undefined
      && pending.selectionId !== selectionId
    ) return
    const clearsCurrent = current !== undefined
      && (path === undefined || current.identity.path === path)
      && (selectionId === undefined || current.selectionId === selectionId)
    const clearsPending = pending !== undefined
      && (path === undefined || pending.path === path)
      && (selectionId === undefined || pending.selectionId === selectionId)
    if (!clearsCurrent && !clearsPending) return

    const generation = this.selections.begin(
      sessionId,
      path ?? current?.identity.path ?? pending?.path ?? '',
      selectionId ?? current?.selectionId ?? pending?.selectionId ?? '',
      true,
    )
    const pendingWrite = this.writes.pending(sessionId)
    if (pendingWrite) await pendingWrite
    const change = this.selections.get(sessionId)
    if (change?.generation !== generation || !change.clear) return
    const latest = this.active.get(sessionId)
    if (
      latest
      && (path === undefined || latest.identity.path === path)
      && (selectionId === undefined || latest.selectionId === selectionId)
    ) this.active.delete(sessionId)
    this.selections.finish(sessionId, generation)
  }
  async replaceSource(
    identity: MindPptFileIdentity,
    source: string,
    expectedVersion: string,
    signal?: AbortSignal,
  ): Promise<{ inspection: DocumentInspection; version: string }> {
    return await this.writes.run(identity.sessionId, async () => {
      const generation = this.selections.generation(identity.sessionId)
      const current = this.requireStableCurrent(identity.sessionId)
      this.assertIdentity(current, identity)
      if (!expectedVersion) {
        throw new Error('MindPPT write requires a workspace file version')
      }
      const version = await this.files.writeText(
        identity, source, expectedVersion, signal,
        () => !this.selections.has(identity.sessionId)
          && this.selections.generation(identity.sessionId) === generation
          && this.active.get(identity.sessionId) === current,
      )
      current.runtime.applySource(source)
      return { inspection: documentInspection(current.identity, current.runtime.view), version }
    })
  }
  async guardedPatch(
    sessionId: string,
    input: GuardedPatchInput,
    signal?: AbortSignal,
  ): Promise<{ ok: true; inspection: DocumentInspection } | { ok: false; reason: string }> {
    return await this.writes.run(sessionId, async () => {
      if (this.selections.has(sessionId)) return selectionChanged()
      const generation = this.selections.generation(sessionId)
      const current = this.requireCurrent(sessionId)
      const snapshot = await this.files.readSnapshot(current.identity, signal)
      if (
        this.selections.has(sessionId)
        || this.selections.generation(sessionId) !== generation
      ) return selectionChanged()
      const patched = applyGuardedPatch(snapshot.source, input)
      if (!patched.ok) return patched
      if (
        this.selections.has(sessionId)
        || this.selections.generation(sessionId) !== generation
      ) return selectionChanged()
      try {
        await this.files.writeText(
          current.identity, patched.source, snapshot.version, signal,
          () => !this.selections.has(sessionId)
            && this.selections.generation(sessionId) === generation
            && this.active.get(sessionId) === current,
        )
      } catch (error) {
        if (error instanceof WorkspacePreCommitRejected) return selectionChanged()
        if (isStaleWrite(error)) {
          return { ok: false, reason: 'stale patch: workspace file changed' }
        }
        throw error
      }
      current.runtime.applySource(patched.source)
      return { ok: true, inspection: documentInspection(current.identity, current.runtime.view) }
    })
  }
  inspect(sessionId: string): DocumentInspection {
    const current = this.requireStableCurrent(sessionId)
    return documentInspection(current.identity, current.runtime.view)
  }
  attempts(sessionId: string): number {
    return this.requireCurrent(sessionId).runtime.attempts
  }
  private isCurrentSelect(
    identity: MindPptFileIdentity,
    generation: number,
    selectionId: string,
  ): boolean {
    return this.selections.isCurrentSelect(
      identity.sessionId, generation, identity.path, selectionId,
    )
  }
  private requireCurrent(sessionId: string): ActiveDocument {
    const current = this.active.get(sessionId)
    if (!current) throw new Error('no selected MindPPT document for this session')
    return current
  }
  private requireStableCurrent(sessionId: string): ActiveDocument {
    if (this.selections.has(sessionId)) {
      throw new Error('stale MindPPT document selection')
    }
    return this.requireCurrent(sessionId)
  }
  private assertIdentity(current: ActiveDocument, identity: MindPptFileIdentity): void {
    if (current.identity.path !== identity.path) {
      throw new Error('stale MindPPT document selection')
    }
  }
}

function selectionChanged() {
  return { ok: false as const, reason: 'stale patch: MindPPT selection changed' }
}

function isStaleWrite(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'FS_STALE_VERSION'
}
