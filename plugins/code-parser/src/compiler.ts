import { MindPptSyntaxError } from './errors.ts'
import { parse } from './parser.ts'
import { tokenize } from './tokenizer.ts'
import type {
  MindPptStructure,
  SlideNode,
  TreeSpec,
} from './types.ts'

const SLIDE_WIDTH = 1600
const SLIDE_HEIGHT = 900
const SLIDE_GAP = 600

export function compileSource(source: string): MindPptStructure {
  const document = parse(tokenize(source))
  const slideById = new Map(document.slides.map((slide) => [slide.id, slide]))

  if (slideById.size !== document.slides.length) {
    throw new MindPptSyntaxError('Slide IDs must be unique')
  }

  if (document.slides.length === 0) {
    throw new MindPptSyntaxError('Document must contain at least one slide')
  }

  if (document.slides.length > 2) {
    throw new MindPptSyntaxError('M1 supports at most two slides')
  }

  let tree: TreeSpec | undefined
  const positions = new Map<string, { x: number; y: number }>()

  if (document.tree) {
    if (document.slides.length !== 2 || document.tree.edges.length !== 1) {
      throw new MindPptSyntaxError(
        'M1 tree layout requires exactly two slides and one edge',
      )
    }

    const edge = document.tree.edges[0]
    if (!edge) throw new MindPptSyntaxError('Tree edge is missing')

    if (!slideById.has(edge.from) || !slideById.has(edge.to)) {
      throw new MindPptSyntaxError(
        `Unknown slide in tree edge: ${edge.from} --> ${edge.to}`,
      )
    }

    positions.set(edge.from, { x: 0, y: 0 })
    positions.set(edge.to, { x: SLIDE_WIDTH + SLIDE_GAP, y: 0 })

    tree = {
      direction: 'LR',
      sourceRange: document.tree.range,
      edges: [
        {
          id: `tree:${edge.from}->${edge.to}`,
          from: edge.from,
          to: edge.to,
          sourceRange: edge.range,
        },
      ],
    }
  } else {
    if (document.slides.length !== 1) {
      throw new MindPptSyntaxError('Two-slide M1 documents require a tree')
    }
    positions.set(document.slides[0]?.id ?? '', { x: 0, y: 0 })
  }

  const slides: SlideNode[] = document.slides.map((slide) => {
    const position = positions.get(slide.id)
    if (!position) {
      throw new MindPptSyntaxError(`Slide "${slide.id}" has no M1 layout position`)
    }

    return {
      id: slide.id,
      x: position.x,
      y: position.y,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      sourceRange: slide.range,
      elements: [
        {
          kind: 'title',
          id: `slide:${slide.id}/title:0`,
          text: slide.title,
          x: 160,
          y: 390,
          width: 1280,
          height: 120,
          sourceRange: slide.titleRange,
        },
      ],
    }
  })

  const structure: MindPptStructure = { version: 0, slides }
  if (tree) structure.tree = tree
  return structure
}
