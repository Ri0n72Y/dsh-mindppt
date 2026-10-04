import type { SourceRange } from './types.ts'
import type {
  LayoutPreset,
  LayoutSlot,
  StructuredValue,
  TreeDirection,
} from './types.ts'

export interface ParsedStructuredValue {
  value: StructuredValue
  range: SourceRange
}

export interface ParsedChartLabel {
  value: string
  range: SourceRange
}

export interface ParsedChartValue {
  value: number
  range: SourceRange
}

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
  | {
      kind: 'table'
      header: ParsedStructuredValue[]
      rows: ParsedStructuredValue[][]
      range: SourceRange
    }
  | {
      kind: 'bar-chart'
      labels: ParsedChartLabel[]
      values: ParsedChartValue[]
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

export interface ParsedSoftLink {
  fromSlideId: string
  toSlideId: string
  range: SourceRange
}

export interface ParsedPathOccurrence {
  slideId: string
  range: SourceRange
}

export interface ParsedPresentationPath {
  name: string
  occurrences: ParsedPathOccurrence[]
  range: SourceRange
}

export interface ParsedDocument {
  slides: ParsedSlide[]
  links: ParsedSoftLink[]
  paths: ParsedPresentationPath[]
  tree?: ParsedTree
}
