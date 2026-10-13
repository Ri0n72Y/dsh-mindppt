import { Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import MindPptCameraService, {
  type CameraView,
} from 'dsh-mindppt-camera'
import MindPptCanvasService, {
  containImages, validSize, type ImageDimensions,
} from 'dsh-mindppt-canvas-excalidraw'
import MindPptEditorService from 'dsh-mindppt-code-editor'
import MindPptLatexPlugin from 'dsh-mindppt-latex'
import MindPptParserService, {
  type MindPptDiagnostic,
} from 'dsh-mindppt-code-parser'
import {
  createCanvasAssetResolver,
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
  const resolveAssets = createCanvasAssetResolver(assetContext)
  let resolvedAssets: ResolvedAssets | undefined
  let imageDimensions: Readonly<Record<string, ImageDimensions>> = {}
  let sourceRevision = 0
  let disposeLatex: (() => Promise<void>) | undefined
  let snapshot: PlaygroundSnapshot = {
    source: '',
    diagnostics: [],
    elements: [],
    files: {},
    camera: cameraService.view,
    extensionRendererTypes: canvasService.extensionRendererTypes,
  }
  const publish = (next: PlaygroundSnapshot) => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const publishProjection = () => {
    publish({
      ...snapshot,
      elements: compileElements(canvasService, resolvedAssets, imageDimensions),
      extensionRendererTypes: canvasService.extensionRendererTypes,
    })
  }
  const setSource = (source: string) => {
    const revision = ++sourceRevision
    const compiled = editorService.setSource(source)
    const assets = compiled
      ? resolveAssets(canvasService.assetRequests)
      : undefined
    if (compiled) {
      resolvedAssets = assets
      imageDimensions = {}
    }
    publish({
      source: editorService.source,
      diagnostics: compiled
        ? [...parserService.diagnostics, ...(assets?.diagnostics ?? [])]
        : [...parserService.diagnostics],
      elements: compiled
        ? compileElements(canvasService, assets, imageDimensions)
        : snapshot.elements,
      files: compiled ? (assets?.files ?? {}) : snapshot.files,
      camera: cameraService.view,
      extensionRendererTypes: canvasService.extensionRendererTypes,
    })
    if (compiled && assets && typeof Image !== 'undefined') {
      void decodeImageDimensions(assets).then(dimensions => {
        if (revision !== sourceRevision) return
        imageDimensions = dimensions
        publish({ ...snapshot,
          elements: compileElements(canvasService, assets, dimensions),
        })
      }).catch(error => {
        if (revision !== sourceRevision) return
        publish({ ...snapshot, diagnostics: [...snapshot.diagnostics, {
          severity: 'error',
          message: 'Local image could not be decoded: ' + String(error),
        }] })
      })
    }
  }
  const refreshElements = () => {
    if (!snapshot.elements.length) return
    publish({
      ...snapshot,
      elements: compileElements(canvasService, resolvedAssets, imageDimensions),
    })
  }
  const enableLatex = async () => {
    if (disposeLatex) return
    const fiber = await ctx.plugin(MindPptLatexPlugin)
    disposeLatex = async () => {
      await fiber.dispose()
    }
    publishProjection()
  }
  const disableLatex = async () => {
    const dispose = disposeLatex
    if (!dispose) return
    disposeLatex = undefined
    await dispose()
    publishProjection()
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
    refreshElements,
    enableLatex,
    disableLatex,
    focusSlide(slideId) {
      applyCameraAction(() => cameraService.focusSlide(slideId))
    },
    focusParent() {
      applyCameraAction(() => cameraService.focusParent())
    },
    focusChild(slideId) {
      applyCameraAction(() => cameraService.focusChild(slideId))
    },
    selectPath(pathId) {
      applyCameraAction(() => cameraService.selectPath(pathId))
    },
    pathPrevious() {
      applyCameraAction(() => cameraService.pathPrevious())
    },
    pathNext() {
      applyCameraAction(() => cameraService.pathNext())
    },
    followSoftLink(linkId) {
      applyCameraAction(() => cameraService.followSoftLink(linkId))
    },
  }
}
function compileElements(
  canvasService: MindPptCanvasService,
  assets: ResolvedAssets | undefined,
  dimensions: Readonly<Record<string, ImageDimensions>>,
): CompiledElements {
  const scene = containImages(canvasService.scene, dimensions).map((element) => {
    if (element.type !== 'image' || !element.id) return element
    const fileId = assets?.elementFileIds[element.id]
    return fileId ? { ...element, fileId } : element
  })
  return convertToExcalidrawElements(scene, { regenerateIds: false })
}

async function decodeImageDimensions(
  assets: ResolvedAssets,
): Promise<Readonly<Record<string, ImageDimensions>>> {
  const dimensions: Record<string, ImageDimensions> = {}
  const decoded = new Map<string, ImageDimensions>()
  for (const [elementId, fileId] of Object.entries(assets.elementFileIds)) {
    let size = decoded.get(fileId)
    if (!size) {
      const data = assets.files[fileId]
      if (!data) continue
      const image = new Image()
      image.src = data.dataURL
      await image.decode()
      if (!validSize(image.naturalWidth, image.naturalHeight)) {
        throw new Error('Invalid intrinsic image dimensions: ' + fileId)
      }
      size = { width: image.naturalWidth, height: image.naturalHeight }
      decoded.set(fileId, size)
    }
    dimensions[elementId] = size
  }
  return dimensions
}
