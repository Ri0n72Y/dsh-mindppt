import { Service, type Context } from '@deepseek-ai/cordis'
import type { MindPptStructure } from 'dsh-mindppt-code-parser'

import {
  collectAssetRequests,
  type CanvasAssetRequest,
} from './assets.ts'
import {
  renderScene,
  type ExcalidrawScene,
} from './scene.ts'

export type { CanvasAssetRequest, ExcalidrawScene }

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

  constructor(ctx: Context) {
    super(ctx, serviceName)

    ctx.on('mindppt/compiled', (structure) => {
      this.applyStructure(structure)
    })

    if (ctx.mindpptParser.structure) {
      this.applyStructure(ctx.mindpptParser.structure)
    }
  }

  private applyStructure(structure: MindPptStructure): void {
    this.scene = renderScene(structure)
    this.assetRequests = collectAssetRequests(structure)
  }
}
