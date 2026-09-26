import { Service, type Context } from '@deepseek-ai/cordis'
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { MindPptStructure } from 'dsh-mindppt-code-parser'

export const serviceName = 'mindpptCanvas' as const

export type ExcalidrawScene = ExcalidrawElementSkeleton[]

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptCanvas: MindPptCanvasService
  }

  interface Events {
    'mindppt/rendered': (scene: ExcalidrawScene) => void
  }
}

/**
 * Mechanical renderer from resolved MindPPT structure to Excalidraw Skeletons.
 * The browser host performs Excalidraw's final skeleton-to-element conversion.
 */
export default class MindPptCanvasService extends Service {
  static inject = ['mindpptParser']

  scene: ExcalidrawScene = []

  constructor(ctx: Context) {
    super(ctx, serviceName)

    ctx.on('mindppt/compiled', (structure) => {
      this.scene = this.render(structure)
      ctx.emit('mindppt/rendered', this.scene)
    })

    if (ctx.mindpptParser.structure) {
      this.scene = this.render(ctx.mindpptParser.structure)
    }
  }

  render(structure: MindPptStructure): ExcalidrawScene {
    return structure.slides.flatMap((slide) => {
      const children: ExcalidrawElementSkeleton[] = slide.elements.map((element) => ({
        type: 'text',
        id: element.id,
        x: slide.x + element.x,
        y: slide.y + element.y,
        width: element.width,
        height: element.height,
        text: element.text,
        fontSize: 72,
        textAlign: 'center',
        verticalAlign: 'middle',
      }))

      const frame: ExcalidrawElementSkeleton = {
        type: 'frame',
        id: `slide:${slide.id}`,
        x: slide.x,
        y: slide.y,
        width: slide.width,
        height: slide.height,
        children: children.flatMap((child) => child.id ? [child.id] : []),
        name: slide.id,
      }

      return [...children, frame]
    })
  }
}
