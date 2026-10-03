import { MindPptCompileError } from './errors.ts'
import type { ParsedContent } from './parsed-types.ts'
import type { ContentNode, LayoutSlot } from './types.ts'

const CONTENT_GAP = 20
const IMAGE_HEIGHT = 390
const BOUND_TEXT_PADDING = 10
const TEXT_LINE_HEIGHT = 1.15
const TEXT_WIDTH_FACTOR = 0.65
const TEXT_HEIGHT_SAFETY = 2

const FONT_SIZE = {
  title: 48,
  subtitle: 30,
  text: 24,
  list: 24,
} as const

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
      ? IMAGE_HEIGHT
      : blockHeight(block, box.width)

    if (
      box.height !== undefined
      && (box.height < 0 || y + height > box.y + box.height)
    ) {
      throw new MindPptCompileError(
        'Content does not fit in the available semantic layout region',
        block.range,
      )
    }

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

export function stackHeight(
  content: ParsedContent[],
  width: number,
): number {
  return content.reduce(
    (height, block, index) =>
      height + blockHeight(block, width) + (index ? CONTENT_GAP : 0),
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

export function blockHeight(
  block: ParsedContent,
  width = Number.POSITIVE_INFINITY,
): number {
  switch (block.kind) {
    case 'title':
      return textBlockHeight(block.text, width, FONT_SIZE.title, 84)
    case 'subtitle':
      return textBlockHeight(block.text, width, FONT_SIZE.subtitle, 56)
    case 'text':
      return textBlockHeight(block.text, width, FONT_SIZE.text, 72)
    case 'list': {
      const text = block.items
        .map((item, index) =>
          block.ordered ? (index + 1) + '. ' + item : '• ' + item,
        )
        .join('\n')
      return Math.max(
        block.items.length * 38 + 24,
        textBlockHeight(text, width, FONT_SIZE.list, 72),
      )
    }
    case 'image':
      return IMAGE_HEIGHT
    case 'extension':
      return Math.max(112, (block.raw.split('\n').length + 1) * 30 + 24)
  }
}

function textBlockHeight(
  text: string,
  width: number,
  fontSize: number,
  minimum: number,
): number {
  if (!Number.isFinite(width)) return minimum

  const lines = wrappedLineCount(text, width, fontSize)
  const measured = Math.ceil(
    lines * fontSize * TEXT_LINE_HEIGHT
      + BOUND_TEXT_PADDING
      + TEXT_HEIGHT_SAFETY,
  )
  return Math.max(minimum, measured)
}

function wrappedLineCount(
  text: string,
  width: number,
  fontSize: number,
): number {
  const columns = Math.max(
    1,
    Math.floor(
      (width - BOUND_TEXT_PADDING) / (fontSize * TEXT_WIDTH_FACTOR),
    ),
  )

  return text
    .split('\n')
    .reduce(
      (total, line) => total + wrappedPhysicalLineCount(line, columns),
      0,
    )
}

function wrappedPhysicalLineCount(
  line: string,
  columns: number,
): number {
  const words = line.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 1

  let lines = 1
  let used = 0

  for (const word of words) {
    const characters = [...word]

    for (let offset = 0; offset < characters.length; offset += columns) {
      const length = Math.min(columns, characters.length - offset)
      const continuation = offset > 0
      const gap = used === 0 || continuation ? 0 : 1

      if (used + gap + length <= columns) {
        used += gap + length
      } else {
        lines += 1
        used = length
      }
    }
  }

  return lines
}
