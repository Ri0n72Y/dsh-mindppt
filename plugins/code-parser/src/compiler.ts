import { MindPptCompileError } from './errors.ts'
import type { ParsedContent } from './content-parser.ts'
import { parse } from './parser.ts'
import { tokenize } from './tokenizer.ts'
import type {
  ContentNode,
  MindPptStructure,
  SlideNode,
  SourceRange,
  TreeEdge,
  TreeSpec,
} from './types.ts'

const SLIDE_WIDTH = 1280
const SLIDE_HEIGHT = 720
const SLIDE_HORIZONTAL_GAP = 600
const SLIDE_VERTICAL_GAP = 320
const CONTENT_X = 96
const CONTENT_WIDTH = SLIDE_WIDTH - CONTENT_X * 2
const CONTENT_GAP = 20

export function compileSource(source: string): MindPptStructure {
  const document = parse(tokenize(source))
  const slideIds = new Set(document.slides.map((slide) => slide.id))

  if (slideIds.size !== document.slides.length) {
    throw new MindPptCompileError('Slide IDs must be unique')
  }

  if (document.slides.length === 0) {
    throw new MindPptCompileError('Document must contain at least one slide')
  }

  let tree: TreeSpec | undefined
  const positions = new Map<string, { x: number; y: number }>()

  if (document.tree) {
    const edges: TreeEdge[] = document.tree.edges.map((edge) => {
      if (!slideIds.has(edge.from) || !slideIds.has(edge.to)) {
        throw new MindPptCompileError(
          `Unknown slide in tree edge: ${edge.from} --> ${edge.to}`,
          edge.range,
        )
      }

      return {
        id: `tree:${edge.from}->${edge.to}`,
        from: edge.from,
        to: edge.to,
        sourceRange: edge.range,
      }
    })

    layoutLrTree(
      document.slides.map((slide) => slide.id),
      edges,
      document.tree.range,
      positions,
    )

    tree = {
      direction: 'LR',
      sourceRange: document.tree.range,
      edges,
    }
  } else {
    if (document.slides.length !== 1) {
      throw new MindPptCompileError('Multiple-slide documents require a tree')
    }
    const slide = document.slides[0]
    if (!slide) throw new MindPptCompileError('Slide is missing')
    positions.set(slide.id, { x: 0, y: 0 })
  }

  const slides: SlideNode[] = document.slides.map((slide) => {
    const position = positions.get(slide.id)
    if (!position) {
      throw new MindPptCompileError(
        `Slide "${slide.id}" has no layout position`,
      )
    }

    return {
      id: slide.id,
      x: position.x,
      y: position.y,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      sourceRange: slide.range,
      elements: layoutContent(slide.id, slide.content),
    }
  })

  const structure: MindPptStructure = { version: 0, slides }
  if (tree) structure.tree = tree
  return structure
}

function layoutLrTree(
  slideIds: string[],
  edges: TreeEdge[],
  treeRange: SourceRange,
  positions: Map<string, { x: number; y: number }>,
): void {
  const children = new Map<string, string[]>()
  const targets = new Set<string>()

  for (const edge of edges) {
    const siblings = children.get(edge.from) ?? []
    siblings.push(edge.to)
    children.set(edge.from, siblings)
    targets.add(edge.to)
  }

  const state = new Map<string, 'visiting' | 'done'>()
  let nextLeaf = 0

  const visit = (slideId: string, depth: number): number => {
    const status = state.get(slideId)
    if (status === 'visiting') {
      throw new MindPptCompileError(
        'M4 LR layout cannot lay out a cyclic primary tree',
        treeRange,
      )
    }

    const existing = positions.get(slideId)
    if (status === 'done' && existing) return existing.y

    state.set(slideId, 'visiting')
    const childIds = children.get(slideId) ?? []

    let y: number
    if (childIds.length === 0) {
      y = nextLeaf * (SLIDE_HEIGHT + SLIDE_VERTICAL_GAP)
      nextLeaf += 1
    } else {
      const childYs = childIds.map((childId) => visit(childId, depth + 1))
      y = (childYs[0]! + childYs.at(-1)!) / 2
    }

    if (!positions.has(slideId)) {
      positions.set(slideId, {
        x: depth * (SLIDE_WIDTH + SLIDE_HORIZONTAL_GAP),
        y,
      })
    }

    state.set(slideId, 'done')
    return positions.get(slideId)!.y
  }

  for (const slideId of slideIds) {
    if (!targets.has(slideId)) visit(slideId, 0)
  }

  for (const slideId of slideIds) {
    if (state.get(slideId) !== 'done') visit(slideId, 0)
  }
}

function layoutContent(
  slideId: string,
  content: ParsedContent[],
): ContentNode[] {
  const only = content[0]
  if (content.length === 1 && only?.kind === 'title') {
    const width = SLIDE_WIDTH * 0.8
    const height = 120
    return [
      {
        kind: 'title',
        id: `slide:${slideId}/title:0`,
        text: only.text,
        x: (SLIDE_WIDTH - width) / 2,
        y: (SLIDE_HEIGHT - height) / 2,
        width,
        height,
        sourceRange: only.range,
      },
    ]
  }

  const counts = {
    title: 0,
    subtitle: 0,
    text: 0,
    list: 0,
    extension: 0,
  }
  const nodes: ContentNode[] = []
  let y = 56

  for (const block of content) {
    const id = `slide:${slideId}/${block.kind}:${counts[block.kind]++}`
    const height = blockHeight(block)
    const box = {
      id,
      x: CONTENT_X,
      y,
      width: CONTENT_WIDTH,
      height,
      sourceRange: block.range,
    }

    if (block.kind === 'list') {
      nodes.push({
        ...box,
        kind: 'list',
        ordered: block.ordered,
        items: block.items,
      })
    } else if (block.kind === 'extension') {
      nodes.push({
        ...box,
        kind: 'extension',
        type: block.type,
        raw: block.raw,
      })
    } else {
      nodes.push({
        ...box,
        kind: block.kind,
        text: block.text,
      })
    }

    y += height + CONTENT_GAP
  }

  return nodes
}

function blockHeight(block: ParsedContent): number {
  switch (block.kind) {
    case 'title':
      return 84
    case 'subtitle':
      return 56
    case 'text':
      return 72
    case 'list':
      return Math.max(72, block.items.length * 38 + 24)
    case 'extension':
      return Math.max(112, (block.raw.split('\n').length + 1) * 30 + 24)
  }
}
