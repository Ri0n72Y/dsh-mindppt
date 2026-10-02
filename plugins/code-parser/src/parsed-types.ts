import type { SourceRange } from './types.ts'
import type {
  LayoutPreset,
  LayoutSlot,
  TreeDirection,
} from './types.ts'

export type ParsedContent =
  | {
      kind: 'title' | 'subtitle' | 'text'
      text: string
      range: SourceRange
    }
  | {
      kind: 'list'
      ordered: boolean
      items: string[]
      range: SourceRange
    }
  | {
      kind: 'image'
      alt: string
      src: string
      range: SourceRange
    }
  | {
      kind: 'extension'
      type: string
      raw: string
      range: SourceRange
    }

export interface ParsedSlide {
  id: string
  layout?: LayoutPreset
  content: ParsedContent[]
  slots: Partial<Record<LayoutSlot, ParsedContent[]>>
  range: SourceRange
}

export interface ParsedTreeEdge {
  from: string
  to: string
  range: SourceRange
}

export interface ParsedTree {
  direction: TreeDirection
  edges: ParsedTreeEdge[]
  range: SourceRange
}

export interface ParsedDocument {
  slides: ParsedSlide[]
  tree?: ParsedTree
}
