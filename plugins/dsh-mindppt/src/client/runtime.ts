import { Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { BinaryFileData, BinaryFiles, DataURL } from '@excalidraw/excalidraw/types'
import { assetWarning, fileId, bytesToDataUrl } from './asset-loader.ts'
import MindPptCameraService, { type CameraView } from 'dsh-mindppt-camera'
import MindPptCanvasService from 'dsh-mindppt-canvas-excalidraw'
import MindPptLatexPlugin from 'dsh-mindppt-latex'
import MindPptParserService, { MindPptCompileError, type MindPptDiagnostic, type MindPptStructure } from 'dsh-mindppt-code-parser'

export type CompiledElements = ReturnType<typeof convertToExcalidrawElements>

export interface BrowserSnapshot {
  revision: number
  structure: MindPptStructure | undefined
  assetStatus: 'ready' | 'pending' | 'failed'
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
  private assetController?: AbortController
  private assetIds: Readonly<Record<string, BinaryFileData['id']>> = {}

  private constructor(
    private readonly parser: MindPptParserService,
    private readonly canvas: MindPptCanvasService,
    private readonly cameraService: MindPptCameraService,
    private readonly readRelated?: ReadRelated,
  ) {
    this.snapshot = {
      structure: undefined,
      revision: 0,
      assetStatus: 'ready',
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
    await ctx.plugin(MindPptCameraService)
    await ctx.plugin(MindPptLatexPlugin)
    let services: [MindPptParserService, MindPptCanvasService, MindPptCameraService] | undefined
    await ctx.plugin({
      name: 'dsh-mindppt-browser-capture',
      inject: ['mindpptParser', 'mindpptCanvas', 'mindpptCamera'],
      apply(runtime: Context) {
        services = [
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
    this.assetController?.abort()
    const currentRevision = ++this.revision
    let compiled = true
    try {
      this.parser.compile(source)
    } catch (error) {
      if (!(error instanceof MindPptCompileError)) throw error
      compiled = false
    }
    const requests = compiled ? this.canvas.assetRequests : []
    this.publish({
      ...this.snapshot,
      revision: currentRevision,
      structure: compiled ? this.parser.structure : undefined,
      assetStatus: requests.length > 0 ? 'pending' : 'ready',
      source: this.parser.source,
      diagnostics: [...this.parser.diagnostics],
      structureCurrent: compiled,
      elements: compiled ? this.resetAssetsAndCompile() : this.snapshot.elements,
      files: compiled ? {} : this.snapshot.files,
      camera: this.cameraService.view,
      rendererTypes: this.canvas.extensionRendererTypes,
    })
    if (compiled && requests.length > 0) {
      const controller = new AbortController()
      this.assetController = controller
      void this.resolveAssets(currentRevision, controller).catch(error => {
        if (currentRevision !== this.revision) return
        this.publish({
          ...this.snapshot,
          assetStatus: 'failed',
          diagnostics: [...this.snapshot.diagnostics, {
            severity: 'error',
            message: 'Unable to load PDF image assets: ' + String(error),
          }],
        })
      })
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

  private async resolveAssets(revision: number, controller: AbortController): Promise<void> {
    if (!this.readRelated) throw new Error('Asset reader unavailable')
    const files: BinaryFiles = {}
    const ids: Record<string, BinaryFileData['id']> = {}
    const diagnostics = [...this.parser.diagnostics]
    let missing = false
    for (const request of this.canvas.assetRequests) {
      const asset = await this.readRelated(request.source, controller.signal)
      if (revision !== this.revision) return
      if (!asset) {
        missing = true
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
      assetStatus: missing ? 'failed' : 'ready',
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

