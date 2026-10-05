import { Service, type Context } from '@deepseek-ai/cordis'
import type { MindPptStructure } from 'dsh-mindppt-code-parser'

import {
  collectAssetRequests,
  type CanvasAssetRequest,
} from './assets.ts'
import type { ExtensionRenderer } from './extension-renderer.ts'
import {
  renderScene,
  type ExcalidrawScene,
} from './scene.ts'

export type { CanvasAssetRequest, ExcalidrawScene }
export {
  CAMERA_TARGET_ZOOM_FACTOR,
  CAMERA_TRAVEL_DURATION,
  CAMERA_ZOOM_IN_DURATION,
  CAMERA_ZOOM_OUT_DURATION,
  CAMERA_ZOOM_OUT_FACTOR,
  replaceMountedFiles,
  runCameraTransition,
} from './presentation.ts'
export type { CameraTransitionController, CanvasFocusRequest } from './presentation.ts'
export type {
  ExtensionNode,
  ExtensionRenderContext,
  ExtensionRenderer,
} from './extension-renderer.ts'

export const serviceName = 'mindpptCanvas' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptCanvas: MindPptCanvasService
  }
}

export default class MindPptCanvasService extends Service {
  static inject = ['mindpptParser']

  scene: ExcalidrawScene = []
  assetRequests: CanvasAssetRequest[] = []

  private structure: MindPptStructure | undefined
  private extensionRenderers = new Map<string, ExtensionRenderer>()

  constructor(ctx: Context) {
    super(ctx, serviceName)

    ctx.on('mindppt/compiled', (structure) => {
      this.applyStructure(structure)
    })

    if (ctx.mindpptParser.structure) {
      this.applyStructure(ctx.mindpptParser.structure)
    }
  }

  get extensionRendererTypes(): readonly string[] {
    return [...this.extensionRenderers.keys()].sort()
  }

  registerExtensionRenderer(
    type: string,
    renderer: ExtensionRenderer,
  ): () => void {
    const normalizedType = type.trim()
    if (!normalizedType) {
      throw new Error('Extension renderer type must not be empty')
    }
    if (this.extensionRenderers.has(normalizedType)) {
      throw new Error(
        'Extension renderer already registered: ' + normalizedType,
      )
    }

    this.extensionRenderers.set(normalizedType, renderer)
    this.reproject()

    let active = true
    return () => {
      if (!active) return
      active = false
      if (this.extensionRenderers.get(normalizedType) !== renderer) return

      this.extensionRenderers.delete(normalizedType)
      this.reproject()
    }
  }

  private applyStructure(structure: MindPptStructure): void {
    this.structure = structure
    this.assetRequests = collectAssetRequests(structure)
    this.reproject()
  }

  private reproject(): void {
    if (!this.structure) return
    this.scene = renderScene(this.structure, this.extensionRenderers)
  }
}
