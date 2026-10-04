import { MindPptCompileError } from './errors.ts'
import { layoutSlideContent } from './content-layout.ts'
import {
  resolvePresentationPaths,
  resolveSoftLinks,
} from './document-semantics.ts'
import { parse } from './parser.ts'
import { tokenize } from './tokenizer.ts'
import { validatePrimaryTree, validateSlideIds } from './tree-validation.ts'
import type {
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

export function compileSource(
  source: string,
  diagnostics: MindPptDiagnostic[] = [],
): MindPptStructure {
  const document = parse(tokenize(source))
  const slideIds = validateSlideIds(document.slides)

  if (document.slides.length === 0) {
    throw new MindPptCompileError('Document must contain at least one slide')
  }

  const links = resolveSoftLinks(document.links, slideIds)
  const paths = resolvePresentationPaths(document.paths, slideIds)

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
        'Slide "' + slide.id + '" has no layout position',
      )
    }

    const node: SlideNode = {
      id: slide.id,
      x: position.x,
      y: position.y,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      sourceRange: slide.range,
      elements: layoutSlideContent(slide, SLIDE_WIDTH, SLIDE_HEIGHT),
    }
    if (slide.layout) node.layout = slide.layout
    return node
  })

  const structure: MindPptStructure = { version: 0, slides }
  if (tree) structure.tree = tree
  if (links.length) structure.links = links
  if (paths.length) structure.paths = paths
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

  const primaryRoot = edges.find((edge) => !targets.has(edge.from))?.from
  if (primaryRoot) visit(primaryRoot, 0)

  for (const slideId of slideIds) {
    if (slideId !== primaryRoot && !targets.has(slideId)) {
      visit(slideId, 0)
    }
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
