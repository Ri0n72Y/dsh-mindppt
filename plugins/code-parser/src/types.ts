export interface SourceRange {
  start: number
  end: number
}

export interface MindPptDiagnostic {
  severity: 'error' | 'warning'
  message: string
  sourceRange?: SourceRange
}

export type LayoutPreset = 'two-column'
export type LayoutSlot = 'left' | 'right'

interface ContentNodeBase {
  id: string
  x: number
  y: number
  width: number
  height: number
  slot?: LayoutSlot
  sourceRange: SourceRange
}

export interface TextNode extends ContentNodeBase {
  kind: 'title' | 'subtitle' | 'text'
  text: string
}

export interface ListNode extends ContentNodeBase {
  kind: 'list'
  ordered: boolean
  items: string[]
}

export interface ImageNode extends ContentNodeBase {
  kind: 'image'
  alt: string
  src: string
}

export interface ExtensionNode extends ContentNodeBase {
  kind: 'extension'
  type: string
  raw: string
}

export type ContentNode = TextNode | ListNode | ImageNode | ExtensionNode

export interface SlideNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  layout?: LayoutPreset
  elements: ContentNode[]
  sourceRange: SourceRange
}

export type TreeDirection = 'LR' | 'RL' | 'TB' | 'TD' | 'BT'

export interface TreeEdge {
  id: string
  from: string
  to: string
  sourceRange: SourceRange
}

export interface TreeSpec {
  direction: TreeDirection
  edges: TreeEdge[]
  sourceRange: SourceRange
}

export interface MindPptStructure {
  version: 0
  slides: SlideNode[]
  tree?: TreeSpec
}
