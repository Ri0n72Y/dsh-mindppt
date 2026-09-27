import { MindPptCompileError } from './errors.ts'
import { parse } from './parser.ts'
import { tokenize } from './tokenizer.ts'
import type { MindPptStructure, SlideNode, TreeSpec } from './types.ts'

const SLIDE_WIDTH = 1280
const SLIDE_HEIGHT = 720
const SLIDE_GAP = 600
const TITLE_WIDTH = SLIDE_WIDTH * 0.8
const TITLE_HEIGHT = 120

export function compileSource(source: string): MindPptStructure {
  const document = parse(tokenize(source))
  const slideIds = new Set(document.slides.map((slide) => slide.id))

  if (slideIds.size !== document.slides.length) {
    throw new MindPptCompileError('Slide IDs must be unique')
  }

  if (document.slides.length === 0) {
    throw new MindPptCompileError('Document must contain at least one slide')
  }

  if (document.slides.length > 2) {
    throw new MindPptCompileError('M1 supports at most two slides')
  }

  let tree: TreeSpec | undefined
  const positions = new Map<string, { x: number; y: number }>()

  if (document.tree) {
    if (document.slides.length !== 2 || document.tree.edges.length !== 1) {
      throw new MindPptCompileError(
        'M1 tree layout requires exactly two slides and one edge',
      )
    }

    const edge = document.tree.edges[0]
    if (!edge) throw new MindPptCompileError('Tree edge is missing')

    if (!slideIds.has(edge.from) || !slideIds.has(edge.to)) {
      throw new MindPptCompileError(
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
      throw new MindPptCompileError('Two-slide M1 documents require a tree')
    }
    const slide = document.slides[0]
    if (!slide) throw new MindPptCompileError('M1 slide is missing')
    positions.set(slide.id, { x: 0, y: 0 })
  }

  const slides: SlideNode[] = document.slides.map((slide) => {
    const position = positions.get(slide.id)
    if (!position) {
      throw new MindPptCompileError(
        `Slide "${slide.id}" has no M1 layout position`,
      )
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
          x: (SLIDE_WIDTH - TITLE_WIDTH) / 2,
          y: (SLIDE_HEIGHT - TITLE_HEIGHT) / 2,
          width: TITLE_WIDTH,
          height: TITLE_HEIGHT,
          sourceRange: slide.titleRange,
        },
      ],
    }
  })

  const structure: MindPptStructure = { version: 0, slides }
  if (tree) structure.tree = tree
  return structure
}
