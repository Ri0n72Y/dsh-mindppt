import type {
  MindPptDiagnostic,
  MindPptStructure,
} from 'dsh-mindppt-code-parser'
import type { RuntimeView } from './runtime.ts'
import type { MindPptFileIdentity } from './shared.ts'

export interface DocumentInspection {
  file: MindPptFileIdentity
  source: string
  diagnostics: readonly MindPptDiagnostic[]
  structureCurrent: boolean
  semantic: ReturnType<typeof semanticProjection>
  tree: MindPptStructure['tree'] | null
  softLinks: NonNullable<MindPptStructure['links']>
  presentationPaths: NonNullable<MindPptStructure['paths']>
  activeExtensionRendererTypes: readonly string[]
  structureBasis: 'current' | 'last-good' | 'none'
}

export function documentInspection(
  file: MindPptFileIdentity,
  view: RuntimeView,
): DocumentInspection {
  return {
    file,
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

export function semanticProjection(structure: MindPptStructure) {
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
