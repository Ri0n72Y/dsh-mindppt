import type { MindPptDiagnostic, MindPptStructure } from 'dsh-mindppt-code-parser'
import { applyGuardedPatch, type GuardedPatchInput, type MindPptFileIdentity } from './shared.ts'
import { MindPptDocumentRuntime } from './runtime.ts'

export interface WorkspaceFilePort {
  readText(absolutePath: string, signal?: AbortSignal): Promise<string>
  writeText(absolutePath: string, source: string, signal?: AbortSignal): Promise<void>
}

export interface DocumentInspection {
  file: { sessionId: string; path: string }
  source: string
  diagnostics: readonly MindPptDiagnostic[]
  structureCurrent: boolean
  semantic: ReturnType<typeof semanticProjection>
  tree: MindPptStructure['tree']
  softLinks: NonNullable<MindPptStructure['links']>
  presentationPaths: NonNullable<MindPptStructure['paths']>
  activeExtensionRendererTypes: readonly string[]
  structureBasis: 'current' | 'last-good'
}

interface ActiveDocument {
  identity: MindPptFileIdentity
  runtime: MindPptDocumentRuntime
}

export class MindPptWorkspaceController {
  private readonly active = new Map<string, ActiveDocument>()

  constructor(private readonly files: WorkspaceFilePort) {}

  async select(identity: MindPptFileIdentity, signal?: AbortSignal): Promise<void> {
    if (!identity.path.toLowerCase().endsWith('.mindppt')) {
      this.active.delete(identity.sessionId)
      return
    }
    const source = await this.files.readText(identity.absolutePath, signal)
    const previous = this.active.get(identity.sessionId)
    if (previous?.identity.absolutePath === identity.absolutePath) {
      previous.identity = identity
      previous.runtime.applySource(source)
      return
    }
    this.active.set(identity.sessionId, {
      identity,
      runtime: await MindPptDocumentRuntime.create(source),
    })
  }

  clear(sessionId: string, path?: string): void {
    const current = this.active.get(sessionId)
    if (!current) return
    if (path !== undefined && current.identity.path !== path) return
    this.active.delete(sessionId)
  }

  async replaceSource(
    identity: MindPptFileIdentity,
    source: string,
    signal?: AbortSignal,
  ): Promise<DocumentInspection> {
    const current = this.requireCurrent(identity.sessionId)
    this.assertIdentity(current, identity)
    await this.files.writeText(identity.absolutePath, source, signal)
    current.runtime.applySource(source)
    return this.inspect(identity.sessionId)
  }

  async guardedPatch(
    sessionId: string,
    input: GuardedPatchInput,
    signal?: AbortSignal,
  ): Promise<{ ok: true; inspection: DocumentInspection } | { ok: false; reason: string }> {
    const current = this.requireCurrent(sessionId)
    const source = await this.files.readText(current.identity.absolutePath, signal)
    const patched = applyGuardedPatch(source, input)
    if (!patched.ok) return patched
    await this.files.writeText(current.identity.absolutePath, patched.source, signal)
    current.runtime.applySource(patched.source)
    return { ok: true, inspection: this.inspect(sessionId) }
  }

  inspect(sessionId: string): DocumentInspection {
    const current = this.requireCurrent(sessionId)
    const view = current.runtime.view
    return {
      file: { sessionId, path: current.identity.path },
      source: view.source,
      diagnostics: view.diagnostics,
      structureCurrent: view.structureCurrent,
      semantic: semanticProjection(view.structure),
      tree: view.structure.tree,
      softLinks: view.structure.links ?? [],
      presentationPaths: view.structure.paths ?? [],
      activeExtensionRendererTypes: view.rendererTypes,
      structureBasis: view.structureCurrent ? 'current' : 'last-good',
    }
  }

  attempts(sessionId: string): number {
    return this.requireCurrent(sessionId).runtime.attempts
  }

  private requireCurrent(sessionId: string): ActiveDocument {
    const current = this.active.get(sessionId)
    if (!current) throw new Error('no selected MindPPT document for this session')
    return current
  }

  private assertIdentity(current: ActiveDocument, identity: MindPptFileIdentity): void {
    if (
      current.identity.path !== identity.path
      || current.identity.absolutePath !== identity.absolutePath
    ) {
      throw new Error('stale MindPPT document selection')
    }
  }
}

function semanticProjection(structure: MindPptStructure) {
  return structure.slides.map(slide => ({
    id: slide.id,
    sourceRange: slide.sourceRange,
    elements: slide.elements.map(element => ({
      id: element.id,
      kind: element.kind,
      sourceRange: element.sourceRange,
    })),
  }))
}
