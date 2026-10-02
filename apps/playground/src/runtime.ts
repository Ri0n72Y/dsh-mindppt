import { Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'

import MindPptCameraService, {
  type CameraView,
} from 'dsh-mindppt-camera'
import MindPptCanvasService from 'dsh-mindppt-canvas-excalidraw'
import MindPptEditorService from 'dsh-mindppt-code-editor'
import MindPptParserService, {
  type MindPptDiagnostic,
} from 'dsh-mindppt-code-parser'

import {
  resolveCanvasAssets,
  type PlaygroundAssetContext,
  type ResolvedAssets,
} from './assets.ts'

export type CompiledElements = ReturnType<typeof convertToExcalidrawElements>

export interface PlaygroundSnapshot {
  source: string
  diagnostics: readonly MindPptDiagnostic[]
  elements: CompiledElements
  files: BinaryFiles
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
  assetContext?: PlaygroundAssetContext,
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
    files: {},
    camera: cameraService.view,
  }

  const publish = (next: PlaygroundSnapshot) => {
    snapshot = next
    for (const listener of listeners) listener()
  }

  const setSource = (source: string) => {
    const compiled = editorService.setSource(source)
    const assets = compiled
      ? resolveCanvasAssets(canvasService.assetRequests, assetContext)
      : undefined

    publish({
      source: editorService.source,
      diagnostics: compiled
        ? [...parserService.diagnostics, ...(assets?.diagnostics ?? [])]
        : [...parserService.diagnostics],
      elements: compiled
        ? compileElements(canvasService, assets)
        : snapshot.elements,
      files: compiled ? (assets?.files ?? {}) : snapshot.files,
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


function compileElements(
  canvasService: MindPptCanvasService,
  assets: ResolvedAssets | undefined,
): CompiledElements {
  const scene = canvasService.scene.map((element) => {
    if (element.type !== 'image' || !element.id) return element

    const fileId = assets?.elementFileIds[element.id]
    return fileId ? { ...element, fileId } : element
  })

  return convertToExcalidrawElements(scene, { regenerateIds: false })
}
