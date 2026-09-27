import { MindPptCompileError } from './errors.ts'
import type { ParsedContent } from './content-parser.ts'
import { parse } from './parser.ts'
import { tokenize } from './tokenizer.ts'
import type {
  ContentNode,
  MindPptStructure,
  SlideNode,
  TreeSpec,
} from './types.ts'

const SLIDE_WIDTH = 1280
const SLIDE_HEIGHT = 720
const SLIDE_GAP = 600
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

  if (document.slides.length > 2) {
    throw new MindPptCompileError('M2 supports at most two slides')
  }

  let tree: TreeSpec | undefined
  const positions = new Map<string, { x: number; y: number }>()

  if (document.tree) {
    if (document.slides.length !== 2 || document.tree.edges.length !== 1) {
      throw new MindPptCompileError(
        'M2 tree layout requires exactly two slides and one edge',
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
      throw new MindPptCompileError('Two-slide M2 documents require a tree')
    }
    const slide = document.slides[0]
    if (!slide) throw new MindPptCompileError('M2 slide is missing')
    positions.set(slide.id, { x: 0, y: 0 })
  }

  const slides: SlideNode[] = document.slides.map((slide) => {
    const position = positions.get(slide.id)
    if (!position) {
      throw new MindPptCompileError(
        `Slide "${slide.id}" has no M2 layout position`,
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
      const node = {
        ...box,
        kind: 'extension' as const,
        type: block.type,
        raw: block.raw,
      }
      debugText('compiler:extension-node', node.raw, {
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      })
      nodes.push(node)
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

function debugText(
  stage: string,
  text: string,
  details: Record<string, unknown>,
): void {
  if (
    (globalThis as { __MINDPPT_DEBUG__?: boolean }).__MINDPPT_DEBUG__ !== true
  ) return

  const lastChar = text.at(-1) ?? ''
  console.debug('[mindppt:pipeline]', {
    stage,
    ...details,
    text,
    length: text.length,
    lastChar,
    lastCodePoint: lastChar ? lastChar.codePointAt(0) : undefined,
    suffix: text.slice(-16),
  })
}
