import type { ParsedContent, ParsedSlide } from './parsed-types.ts'
import type { ContentNode, LayoutSlot } from './types.ts'

const CONTENT_X = 96
const CONTENT_TOP = 56
const CONTENT_GAP = 20
const TWO_COLUMN_GAP = 48
const SLOT_TOP_GAP = 36
const SLIDE_BOTTOM_GAP = 56
const IMAGE_HEIGHT = 390
const HERO_SIDE_GAP = 160
const TITLE_CONTENT_X = 128
const TITLE_CONTENT_GAP = 44

export function layoutSlideContent(
  slide: ParsedSlide,
  slideWidth: number,
  slideHeight: number,
): ContentNode[] {
  switch (slide.layout) {
    case 'hero':
      return layoutHero(slide, slideWidth, slideHeight)
    case 'title-content':
      return layoutTitleContent(slide, slideWidth, slideHeight)
    case 'two-column':
      return layoutTwoColumn(slide, slideWidth, slideHeight)
    default:
      return layoutDefault(slide, slideWidth, slideHeight)
  }
}

function layoutDefault(
  slide: ParsedSlide,
  slideWidth: number,
  slideHeight: number,
): ContentNode[] {
  const only = slide.content[0]
  if (slide.content.length === 1 && only?.kind === 'title') {
    const width = slideWidth * 0.8
    const height = 120
    return [{
      kind: 'title',
      id: 'slide:' + slide.id + '/title:0',
      text: only.text,
      x: (slideWidth - width) / 2,
      y: (slideHeight - height) / 2,
      width,
      height,
      sourceRange: only.range,
    }]
  }

  return layoutStack(
    slide.id,
    slide.content,
    { x: CONTENT_X, y: CONTENT_TOP, width: slideWidth - CONTENT_X * 2 },
  )
}

function layoutHero(
  slide: ParsedSlide,
  slideWidth: number,
  slideHeight: number,
): ContentNode[] {
  const width = slideWidth - HERO_SIDE_GAP * 2
  const height = stackHeight(slide.content)
  const y = Math.max(CONTENT_TOP, (slideHeight - height) / 2)

  return layoutStack(
    slide.id,
    slide.content,
    {
      x: HERO_SIDE_GAP,
      y,
      width,
      height: Math.max(0, slideHeight - y - SLIDE_BOTTOM_GAP),
    },
  )
}

function layoutTitleContent(
  slide: ParsedSlide,
  slideWidth: number,
  slideHeight: number,
): ContentNode[] {
  const first = slide.content[0]
  const bodyX = TITLE_CONTENT_X
  const bodyWidth = slideWidth - bodyX * 2

  if (first?.kind !== 'title') {
    return layoutStack(
      slide.id,
      slide.content,
      {
        x: bodyX,
        y: CONTENT_TOP,
        width: bodyWidth,
        height: slideHeight - CONTENT_TOP - SLIDE_BOTTOM_GAP,
      },
    )
  }

  const counts = createContentCounts()
  const title = layoutStack(
    slide.id,
    [first],
    { x: CONTENT_X, y: CONTENT_TOP, width: slideWidth - CONTENT_X * 2 },
    undefined,
    counts,
  )
  const bodyY = CONTENT_TOP + blockHeight(first) + TITLE_CONTENT_GAP

  return [
    ...title,
    ...layoutStack(
      slide.id,
      slide.content.slice(1),
      {
        x: bodyX,
        y: bodyY,
        width: bodyWidth,
        height: slideHeight - bodyY - SLIDE_BOTTOM_GAP,
      },
      undefined,
      counts,
    ),
  ]
}

function layoutTwoColumn(
  slide: ParsedSlide,
  slideWidth: number,
  slideHeight: number,
): ContentNode[] {
  const contentWidth = slideWidth - CONTENT_X * 2
  const header = layoutStack(
    slide.id,
    slide.content,
    { x: CONTENT_X, y: CONTENT_TOP, width: contentWidth },
  )
  const headerBottom = header.length
    ? Math.max(...header.map((node) => node.y + node.height))
    : CONTENT_TOP
  const slotTop = header.length
    ? headerBottom + SLOT_TOP_GAP
    : CONTENT_TOP
  const slotWidth = (contentWidth - TWO_COLUMN_GAP) / 2
  const slotHeight = Math.max(0, slideHeight - slotTop - SLIDE_BOTTOM_GAP)

  return [
    ...header,
    ...layoutStack(
      slide.id,
      slide.slots.left ?? [],
      { x: CONTENT_X, y: slotTop, width: slotWidth, height: slotHeight },
      'left',
    ),
    ...layoutStack(
      slide.id,
      slide.slots.right ?? [],
      {
        x: CONTENT_X + slotWidth + TWO_COLUMN_GAP,
        y: slotTop,
        width: slotWidth,
        height: slotHeight,
      },
      'right',
    ),
  ]
}

function layoutStack(
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

function stackHeight(content: ParsedContent[]): number {
  return content.reduce(
    (height, block, index) =>
      height + blockHeight(block) + (index ? CONTENT_GAP : 0),
    0,
  )
}

function createContentCounts(): Record<ParsedContent['kind'], number> {
  return {
    title: 0,
    subtitle: 0,
    text: 0,
    list: 0,
    image: 0,
    extension: 0,
  }
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
    case 'image':
      return IMAGE_HEIGHT
    case 'extension':
      return Math.max(112, (block.raw.split('\n').length + 1) * 30 + 24)
  }
}
