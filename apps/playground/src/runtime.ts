import { Context } from '@deepseek-ai/cordis'
import MindPptCameraService from 'dsh-mindppt-camera'
import MindPptCanvasService, { type ImageDimensions } from 'dsh-mindppt-canvas-excalidraw'
import MindPptEditorService from 'dsh-mindppt-code-editor'
import MindPptLatexPlugin from 'dsh-mindppt-latex'
import MindPptParserService from 'dsh-mindppt-code-parser'
import { createCanvasAssetResolver, type PlaygroundAssetContext, type ResolvedAssets } from './assets.ts'
import { compileElements, decodeImageDimensions, retainImageDimensions } from './image-projection.ts'
import type { PlaygroundRuntime, PlaygroundSnapshot } from './runtime-types.ts'

export type { CompiledElements } from './image-projection.ts'

export type { PlaygroundSnapshot, PlaygroundRuntime } from './runtime-types.ts'

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
  const decodedSizes = new Map<string, ImageDimensions>()
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
    listeners.forEach(listener => listener())
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
      imageDimensions = retainImageDimensions(assets, decodedSizes)
      resolvedAssets = assets
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
    if (compiled && assets && typeof Image !== 'undefined'
      && Object.keys(imageDimensions).length !== Object.keys(assets.elementFileIds).length) {
      void decodeImageDimensions(assets, (id, fileId, result) => {
        if (revision !== sourceRevision) return
        if (result.size) {
          decodedSizes.set(fileId, result.size)
          imageDimensions = { ...imageDimensions, [id]: result.size }
          publishProjection()
        } else {
          const request = canvasService.assetRequests.find(r => r.elementIds.includes(id))
          publish({ ...snapshot, diagnostics: [...snapshot.diagnostics, {
            severity: 'error',
            message: 'Local image could not be decoded: '
              + (request?.source ?? fileId) + ': ' + result.error,
            ...(request?.sourceRange ? { sourceRange: request.sourceRange } : {}),
          }] })
        }
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
    if (action()) publish({ ...snapshot, camera: cameraService.view })
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
