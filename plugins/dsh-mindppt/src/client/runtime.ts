import { Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { BinaryFileData, BinaryFiles, DataURL } from '@excalidraw/excalidraw/types'
import MindPptCameraService, { type CameraView } from 'dsh-mindppt-camera'
import MindPptCanvasService, { type CanvasAssetRequest } from 'dsh-mindppt-canvas-excalidraw'
import MindPptEditorService from 'dsh-mindppt-code-editor'
import MindPptLatexPlugin from 'dsh-mindppt-latex'
import MindPptParserService, { type MindPptDiagnostic } from 'dsh-mindppt-code-parser'

export type CompiledElements = ReturnType<typeof convertToExcalidrawElements>

export interface BrowserSnapshot {
  source: string
  diagnostics: readonly MindPptDiagnostic[]
  structureCurrent: boolean
  elements: CompiledElements
  files: BinaryFiles
  camera: CameraView
  rendererTypes: readonly string[]
}

export interface RelatedAsset {
  data: Uint8Array<ArrayBuffer>
  mimeType: BinaryFileData['mimeType']
}

export type ReadRelated = (source: string, signal: AbortSignal) => Promise<RelatedAsset | undefined>

export class BrowserMindPptRuntime {
  private snapshot: BrowserSnapshot
  private readonly listeners = new Set<() => void>()
  private revision = 0
  private assetIds: Readonly<Record<string, BinaryFileData['id']>> = {}

  private constructor(
    private readonly editor: MindPptEditorService,
    private readonly parser: MindPptParserService,
    private readonly canvas: MindPptCanvasService,
    private readonly cameraService: MindPptCameraService,
    private readonly readRelated?: ReadRelated,
  ) {
    this.snapshot = {
      source: '',
      diagnostics: [],
      structureCurrent: false,
      elements: [],
      files: {},
      camera: cameraService.view,
      rendererTypes: canvas.extensionRendererTypes,
    }
  }

  static async create(source: string, readRelated?: ReadRelated) {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)
    await ctx.plugin(MindPptEditorService)
    await ctx.plugin(MindPptCameraService)
    await ctx.plugin(MindPptLatexPlugin)
    let services: [MindPptEditorService, MindPptParserService, MindPptCanvasService, MindPptCameraService] | undefined
    await ctx.plugin({
      name: 'dsh-mindppt-browser-capture',
      inject: ['mindpptEditor', 'mindpptParser', 'mindpptCanvas', 'mindpptCamera'],
      apply(runtime: Context) {
        services = [
          runtime.mindpptEditor,
          runtime.mindpptParser,
          runtime.mindpptCanvas,
          runtime.mindpptCamera,
        ]
      },
    })
    if (!services) throw new Error('MindPPT browser runtime unavailable')
    const runtime = new BrowserMindPptRuntime(...services, readRelated)
    runtime.setSource(source)
    return runtime
  }

  getSnapshot = (): BrowserSnapshot => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setSource(source: string): boolean {
    const currentRevision = ++this.revision
    const compiled = this.editor.setSource(source)
    this.publish({
      ...this.snapshot,
      source: this.editor.source,
      diagnostics: [...this.parser.diagnostics],
      structureCurrent: compiled,
      elements: compiled ? this.resetAssetsAndCompile() : this.snapshot.elements,
      files: compiled ? {} : this.snapshot.files,
      camera: this.cameraService.view,
      rendererTypes: this.canvas.extensionRendererTypes,
    })
    if (compiled && this.readRelated) {
      void this.resolveAssets(currentRevision)
    }
    return compiled
  }

  refreshElements = (): void => {
    if (!this.snapshot.structureCurrent) return
    this.publish({ ...this.snapshot, elements: this.compileElements() })
  }

  focusSlide(id: string) { this.camera(() => this.cameraService.focusSlide(id)) }
  focusParent() { this.camera(() => this.cameraService.focusParent()) }
  focusChild(id: string) { this.camera(() => this.cameraService.focusChild(id)) }
  selectPath(id: string) { this.camera(() => this.cameraService.selectPath(id)) }
  pathPrevious() { this.camera(() => this.cameraService.pathPrevious()) }
  pathNext() { this.camera(() => this.cameraService.pathNext()) }
  followSoftLink(id: string) { this.camera(() => this.cameraService.followSoftLink(id)) }

  private camera(action: () => boolean): void {
    if (!action()) return
    this.publish({ ...this.snapshot, camera: this.cameraService.view })
  }

  private async resolveAssets(revision: number): Promise<void> {
    if (!this.readRelated) return
    const controller = new AbortController()
    const files: BinaryFiles = {}
    const ids: Record<string, BinaryFileData['id']> = {}
    const diagnostics = [...this.parser.diagnostics]
    for (const request of this.canvas.assetRequests) {
      const asset = await this.readRelated(request.source, controller.signal)
      if (revision !== this.revision) return
      if (!asset) {
        diagnostics.push(assetWarning(request))
        continue
      }
      const id = fileId(request.source, asset.data) as BinaryFileData['id']
      const dataURL = await bytesToDataUrl(asset.data, asset.mimeType)
      files[id] = { id, dataURL: dataURL as DataURL, mimeType: asset.mimeType, created: 0 }
      for (const elementId of request.elementIds) ids[elementId] = id
    }
    if (revision !== this.revision) return
    this.assetIds = ids
    this.publish({
      ...this.snapshot,
      diagnostics,
      files,
      elements: this.compileElements(),
    })
  }

  private resetAssetsAndCompile(): CompiledElements {
    this.assetIds = {}
    return this.compileElements()
  }

  private compileElements(): CompiledElements {
    const scene = this.canvas.scene.map(element => {
      if (element.type !== 'image' || !element.id) return element
      const fileId = this.assetIds[element.id]
      return fileId ? { ...element, fileId } : element
    })
    return convertToExcalidrawElements(scene, { regenerateIds: false })
  }

  private publish(next: BrowserSnapshot): void {
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}

function assetWarning(request: CanvasAssetRequest): MindPptDiagnostic {
  return {
    severity: 'warning',
    message: 'Local asset unavailable: ' + request.source,
    sourceRange: request.sourceRange,
  }
}

function fileId(source: string, data: Uint8Array<ArrayBuffer>): string {
  let hash = 2166136261
  for (const char of source) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  for (const byte of data) hash = Math.imul(hash ^ byte, 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0').repeat(5)
}

function bytesToDataUrl(data: Uint8Array<ArrayBuffer>, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(new Blob([data], { type: mimeType }))
  })
}
