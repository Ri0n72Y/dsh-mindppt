import type { ParsedContent } from './parsed-types.ts'
import type { ContentNode, LayoutSlot } from './types.ts'

const CONTENT_GAP = 20
const IMAGE_HEIGHT = 390

export function layoutStack(
  slideId: string,
  content: ParsedContent[],
  box: { x: number; y: number; width: number; height?: number },
  slot?: LayoutSlot,
  counts = createContentCounts(),
): ContentNode[] {
  const nodes: ContentNode[] = []
  let y = box.y

  for (const block of content) {
    const prefix = 'slide:' + slideId + (slot ? '/' + slot : '')
    const id = prefix + '/' + block.kind + ':' + counts[block.kind]++
    const height = block.kind === 'image'
      ? Math.min(IMAGE_HEIGHT, box.height ?? IMAGE_HEIGHT)
      : blockHeight(block)
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
      return 84
    case 'subtitle':
      return 56
    case 'text':
      return 72
    case 'list':
      return Math.max(72, block.items.length * 38 + 24)
    case 'image':
      return IMAGE_HEIGHT
    case 'extension':
      return Math.max(112, (block.raw.split('\n').length + 1) * 30 + 24)
  }
}
