import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { CameraView } from 'dsh-mindppt-camera'
import type { MindPptDiagnostic } from 'dsh-mindppt-code-parser'
import type { CompiledElements } from './image-projection.ts'

export interface PlaygroundSnapshot {
  source: string
  diagnostics: readonly MindPptDiagnostic[]
  elements: CompiledElements
  files: BinaryFiles
  camera: CameraView
  extensionRendererTypes: readonly string[]
}
export interface PlaygroundRuntime {
  getSnapshot: () => PlaygroundSnapshot
  subscribe: (listener: () => void) => () => void
  setSource: (source: string) => void
  refreshElements: () => void
  enableLatex: () => Promise<void>
  disableLatex: () => Promise<void>
  focusSlide: (slideId: string) => void
  focusParent: () => void
  focusChild: (slideId: string) => void
  selectPath: (pathId: string) => void
  pathPrevious: () => void
  pathNext: () => void
  followSoftLink: (linkId: string) => void
}
