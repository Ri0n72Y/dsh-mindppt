import { Service, type Context } from '@deepseek-ai/cordis'
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { MindPptStructure } from 'dsh-mindppt-code-parser'

export const serviceName = 'mindpptCanvas' as const

export type ExcalidrawScene = ExcalidrawElementSkeleton[]

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
      this.scene = this.render(structure)
    })

    if (ctx.mindpptParser.structure) {
      this.scene = this.render(ctx.mindpptParser.structure)
    }
  }

  render(structure: MindPptStructure): ExcalidrawScene {
    return structure.slides.flatMap((slide) => {
      const shadow: ExcalidrawElementSkeleton = {
        type: 'rectangle',
        id: `slide:${slide.id}/shadow`,
        x: slide.x + 18,
        y: slide.y + 18,
        width: slide.width,
        height: slide.height,
        backgroundColor: '#000000',
        strokeColor: 'transparent',
        fillStyle: 'solid',
        opacity: 14,
      }

      const surface: ExcalidrawElementSkeleton = {
        type: 'rectangle',
        id: `slide:${slide.id}/surface`,
        x: slide.x,
        y: slide.y,
        width: slide.width,
        height: slide.height,
        backgroundColor: '#ffffff',
        strokeColor: '#d0d0d0',
        fillStyle: 'solid',
        strokeWidth: 1,
      }

      const content: ExcalidrawElementSkeleton[] = slide.elements.map((element) => ({
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
        children: [surface, ...content].flatMap((child) =>
          child.id ? [child.id] : [],
        ),
        name: slide.id,
      }

      return [shadow, surface, ...content, frame]
    })
  }
}
