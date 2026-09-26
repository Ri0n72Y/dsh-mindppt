import { Service, type Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { MindPptStructure } from 'dsh-mindppt-code-parser'

export const serviceName = 'mindpptCanvas' as const

export type RenderedElements = ReturnType<typeof convertToExcalidrawElements>

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptCanvas: MindPptCanvasService
  }

  interface Events {
    'mindppt/rendered': (elements: RenderedElements) => void
  }
}

/**
 * Mechanical renderer from resolved MindPPT structure to Excalidraw elements.
 * Presentation semantics and layout stay in code-parser.
 */
export default class MindPptCanvasService extends Service {
  static inject = ['mindpptParser']

  elements: RenderedElements = []

  constructor(ctx: Context) {
    super(ctx, serviceName)

    ctx.on('mindppt/compiled', (structure) => {
      this.elements = this.render(structure)
      ctx.emit('mindppt/rendered', this.elements)
    })

    if (ctx.mindpptParser.structure) {
      this.elements = this.render(ctx.mindpptParser.structure)
    }
  }

  render(structure: MindPptStructure): RenderedElements {
    const skeletons = structure.slides.flatMap((slide) => {
      const children = slide.elements.map((element) => ({
        type: 'text' as const,
        id: element.id,
        x: slide.x + element.x,
        y: slide.y + element.y,
        width: element.width,
        height: element.height,
        text: element.text,
        fontSize: 72,
        textAlign: 'center' as const,
        verticalAlign: 'middle' as const,
      }))

      return [
        ...children,
        {
          type: 'frame' as const,
          id: `slide:${slide.id}`,
          x: slide.x,
          y: slide.y,
          width: slide.width,
          height: slide.height,
          children: children.map((child) => child.id),
          name: slide.id,
        },
      ]
    })

    return convertToExcalidrawElements(skeletons, { regenerateIds: false })
  }
}
