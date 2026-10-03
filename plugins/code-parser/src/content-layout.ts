import type { ParsedSlide } from './parsed-types.ts'
import {
  blockHeight,
  createContentCounts,
  layoutStack,
  stackHeight,
} from './content-stack.ts'
import type { ContentNode } from './types.ts'

const CONTENT_X = 96
const CONTENT_TOP = 56
const TWO_COLUMN_GAP = 48
const SLOT_TOP_GAP = 36
const SLIDE_BOTTOM_GAP = 56
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
    const height = blockHeight(only, width)

    if (height > slideHeight - CONTENT_TOP - SLIDE_BOTTOM_GAP) {
      return layoutStack(
        slide.id,
        slide.content,
        {
          x: (slideWidth - width) / 2,
          y: CONTENT_TOP,
          width,
          height: slideHeight - CONTENT_TOP - SLIDE_BOTTOM_GAP,
        },
      )
    }

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
    {
      x: CONTENT_X,
      y: CONTENT_TOP,
      width: slideWidth - CONTENT_X * 2,
      height: slideHeight - CONTENT_TOP - SLIDE_BOTTOM_GAP,
    },
  )
}

function layoutHero(
  slide: ParsedSlide,
  slideWidth: number,
  slideHeight: number,
): ContentNode[] {
  const width = slideWidth - HERO_SIDE_GAP * 2
  const height = stackHeight(slide.content, width)
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
  const titleWidth = slideWidth - CONTENT_X * 2
  const title = layoutStack(
    slide.id,
    [first],
    {
      x: CONTENT_X,
      y: CONTENT_TOP,
      width: titleWidth,
      height: slideHeight - CONTENT_TOP - SLIDE_BOTTOM_GAP,
    },
    undefined,
    counts,
  )
  const titleHeight = title[0]?.height ?? blockHeight(first, titleWidth)
  const bodyY = CONTENT_TOP + titleHeight + TITLE_CONTENT_GAP

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
    {
      x: CONTENT_X,
      y: CONTENT_TOP,
      width: contentWidth,
      height: slideHeight - CONTENT_TOP - SLIDE_BOTTOM_GAP,
    },
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
