import type { ParsedContent } from './parsed-types.ts'
import type { ContentNode, LayoutSlot } from './types.ts'

const CONTENT_GAP = 20
const IMAGE_HEIGHT = 390

const BLOCK_HEIGHT = {
  title: 84,
  subtitle: 56,
  text: 72,
  extension: 112,
} as const

export function layoutStack(
  slideId: string,
  content: ParsedContent[],
  box: { x: number; y: number; width: number },
  slot?: LayoutSlot,
  counts = createContentCounts(),
): ContentNode[] {
  const nodes: ContentNode[] = []
  let y = box.y

  for (const block of content) {
    const prefix = 'slide:' + slideId + (slot ? '/' + slot : '')
    const id = prefix + '/' + block.kind + ':' + counts[block.kind]++
    const height = blockHeight(block)

    const geometry = {
      id,
      x: box.x,
      y,
      width: box.width,
      height,
      ...(slot ? { slot } : {}),
      sourceRange: block.range,
    }

    if (block.kind === 'list') {
      nodes.push({
        ...geometry,
        kind: 'list',
        ordered: block.ordered,
        items: block.items,
      })
    } else if (block.kind === 'image') {
      nodes.push({
        ...geometry,
        kind: 'image',
        alt: block.alt,
        src: block.src,
      })
    } else if (block.kind === 'extension') {
      nodes.push({
        ...geometry,
        kind: 'extension',
        type: block.type,
        raw: block.raw,
      })
    } else {
      nodes.push({
        ...geometry,
        kind: block.kind,
        text: block.text,
      })
    }

    y += height + CONTENT_GAP
  }

  return nodes
}

export function stackHeight(content: ParsedContent[]): number {
  return content.reduce(
    (height, block, index) =>
      height + blockHeight(block) + (index ? CONTENT_GAP : 0),
    0,
  )
}

export function createContentCounts(): Record<ParsedContent['kind'], number> {
  return {
    title: 0,
    subtitle: 0,
    text: 0,
    list: 0,
    image: 0,
    extension: 0,
  }
}

export function blockHeight(block: ParsedContent): number {
  switch (block.kind) {
    case 'title':
      return BLOCK_HEIGHT.title
    case 'subtitle':
      return BLOCK_HEIGHT.subtitle
    case 'text':
      return BLOCK_HEIGHT.text
    case 'list':
      return Math.max(block.items.length * 38 + 24, BLOCK_HEIGHT.text)
    case 'image':
      return IMAGE_HEIGHT
    case 'extension':
      return BLOCK_HEIGHT.extension
  }
}
