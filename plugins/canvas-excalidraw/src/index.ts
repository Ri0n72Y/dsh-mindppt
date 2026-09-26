import { Service, type Context } from '@deepseek-ai/cordis'

import {
  renderScene,
  type ExcalidrawScene,
} from './scene.ts'

export type { ExcalidrawScene }

export const serviceName = 'mindpptCanvas' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptCanvas: MindPptCanvasService
  }
}

export default class MindPptCanvasService extends Service {
  static inject = ['mindpptParser']

  scene: ExcalidrawScene = []

  constructor(ctx: Context) {
    super(ctx, serviceName)

    ctx.on('mindppt/compiled', (structure) => {
      this.scene = renderScene(structure)
    })

    if (ctx.mindpptParser.structure) {
      this.scene = renderScene(ctx.mindpptParser.structure)
    }
  }
}
