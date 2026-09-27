import { MindPptCompileError } from './errors.ts'
import type { ParsedContent } from './content-parser.ts'
import { parse } from './parser.ts'
import { tokenize } from './tokenizer.ts'
import { validatePrimaryTree, validateSlideIds } from './tree-validation.ts'
import type {
  ContentNode,
  MindPptDiagnostic,
  MindPptStructure,
  SlideNode,
  TreeDirection,
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

export function compileSource(
  source: string,
  diagnostics: MindPptDiagnostic[] = [],
): MindPptStructure {
  const document = parse(tokenize(source))
  const slideIds = validateSlideIds(document.slides)

  if (document.slides.length === 0) {
    throw new MindPptCompileError('Document must contain at least one slide')
  }

  let tree: TreeSpec | undefined
  const positions = new Map<string, { x: number; y: number }>()

  if (document.tree) {
    const validated = validatePrimaryTree(
      document.slides,
      document.tree.edges,
      slideIds,
    )
    const edges = validated.edges
    diagnostics.push(...validated.warnings)

    layoutTree(
      document.slides.map((slide) => slide.id),
      edges,
      document.tree.direction,
      positions,
    )

    tree = {
      direction: document.tree.direction,
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

function layoutTree(
  slideIds: string[],
  edges: TreeEdge[],
  direction: TreeDirection,
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

  const positioned = new Set<string>()
  let nextLeaf = 0
  const crossStep = isHorizontal(direction)
    ? SLIDE_HEIGHT + SLIDE_VERTICAL_GAP
    : SLIDE_WIDTH + SLIDE_HORIZONTAL_GAP

  const visit = (slideId: string, depth: number): number => {
    const existing = positions.get(slideId)
    if (positioned.has(slideId) && existing) {
      return crossCoordinate(existing, direction)
    }

    const childIds = children.get(slideId) ?? []
    let cross: number

    if (childIds.length === 0) {
      cross = nextLeaf * crossStep
      nextLeaf += 1
    } else {
      const childCrosses = childIds.map((childId) => visit(childId, depth + 1))
      cross = (childCrosses[0]! + childCrosses.at(-1)!) / 2
    }

    positions.set(slideId, projectPosition(direction, depth, cross))
    positioned.add(slideId)
    return cross
  }

  for (const slideId of slideIds) {
    if (!targets.has(slideId)) visit(slideId, 0)
  }

  for (const slideId of slideIds) {
    if (!positioned.has(slideId)) visit(slideId, 0)
  }
}

function projectPosition(
  direction: TreeDirection,
  depth: number,
  cross: number,
): { x: number; y: number } {
  const horizontalDepth = depth * (SLIDE_WIDTH + SLIDE_HORIZONTAL_GAP)
  const verticalDepth = depth * (SLIDE_HEIGHT + SLIDE_VERTICAL_GAP)

  switch (direction) {
    case 'LR':
      return { x: horizontalDepth, y: cross }
    case 'RL':
      return { x: -horizontalDepth, y: cross }
    case 'TB':
    case 'TD':
      return { x: cross, y: verticalDepth }
    case 'BT':
      return { x: cross, y: -verticalDepth }
  }
}

function crossCoordinate(
  position: { x: number; y: number },
  direction: TreeDirection,
): number {
  return isHorizontal(direction) ? position.y : position.x
}

function isHorizontal(direction: TreeDirection): boolean {
  return direction === 'LR' || direction === 'RL'
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
