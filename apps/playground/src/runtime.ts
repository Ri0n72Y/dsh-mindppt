import { Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

import MindPptCameraService, {
  type CameraView,
} from 'dsh-mindppt-camera'
import MindPptCanvasService from 'dsh-mindppt-canvas-excalidraw'
import MindPptEditorService from 'dsh-mindppt-code-editor'
import MindPptParserService, {
  type MindPptDiagnostic,
} from 'dsh-mindppt-code-parser'

export type CompiledElements = ReturnType<typeof convertToExcalidrawElements>

export interface PlaygroundSnapshot {
  source: string
  diagnostics: readonly MindPptDiagnostic[]
  elements: CompiledElements
  camera: CameraView
}

export interface PlaygroundRuntime {
  getSnapshot: () => PlaygroundSnapshot
  subscribe: (listener: () => void) => () => void
  setSource: (source: string) => void
  focusSlide: (slideId: string) => void
  focusParent: () => void
  focusChild: (slideId: string) => void
}

export async function createPlaygroundRuntime(
  initialSource: string,
): Promise<PlaygroundRuntime> {
  const ctx = new Context()

  await ctx.plugin(MindPptParserService)
  await ctx.plugin(MindPptCanvasService)
  await ctx.plugin(MindPptEditorService)
  await ctx.plugin(MindPptCameraService)

  let editor: MindPptEditorService | undefined
  let parser: MindPptParserService | undefined
  let canvas: MindPptCanvasService | undefined
  let camera: MindPptCameraService | undefined

  await ctx.plugin({
    name: 'mindppt-playground-driver',
    inject: [
      'mindpptEditor',
      'mindpptParser',
      'mindpptCanvas',
      'mindpptCamera',
    ],
    apply(runtime: Context) {
      editor = runtime.mindpptEditor
      parser = runtime.mindpptParser
      canvas = runtime.mindpptCanvas
      camera = runtime.mindpptCamera
    },
  })

  if (!editor || !parser || !canvas || !camera) {
    throw new Error('MindPPT runtime services were not initialized')
  }

  const editorService = editor
  const parserService = parser
  const canvasService = canvas
  const cameraService = camera

  const listeners = new Set<() => void>()
  let snapshot: PlaygroundSnapshot = {
    source: '',
    diagnostics: [],
    elements: [],
    camera: cameraService.view,
  }

  const publish = (next: PlaygroundSnapshot) => {
    snapshot = next
    for (const listener of listeners) listener()
  }

  const setSource = (source: string) => {
    const compiled = editorService.setSource(source)

    publish({
      source: editorService.source,
      diagnostics: [...parserService.diagnostics],
      elements: compiled
        ? convertToExcalidrawElements(canvasService.scene, { regenerateIds: false })
        : snapshot.elements,
      camera: cameraService.view,
    })
  }

  const applyCameraAction = (action: () => boolean) => {
    if (!action()) return
    publish({
      ...snapshot,
      camera: cameraService.view,
    })
  }

  setSource(initialSource)

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setSource,
    focusSlide(slideId) {
      applyCameraAction(() => cameraService.focusSlide(slideId))
    },
    focusParent() {
      applyCameraAction(() => cameraService.focusParent())
    },
    focusChild(slideId) {
      applyCameraAction(() => cameraService.focusChild(slideId))
    },
  }
}
