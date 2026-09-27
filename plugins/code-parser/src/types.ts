export interface SourceRange {
  start: number
  end: number
}

export interface MindPptDiagnostic {
  severity: 'error' | 'warning'
  message: string
  sourceRange?: SourceRange
}

interface ContentNodeBase {
  id: string
  x: number
  y: number
  width: number
  height: number
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

export interface ExtensionNode extends ContentNodeBase {
  kind: 'extension'
  type: string
  raw: string
}

export type ContentNode = TextNode | ListNode | ExtensionNode

export interface SlideNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  elements: ContentNode[]
  sourceRange: SourceRange
}

export interface TreeEdge {
  id: string
  from: string
  to: string
  sourceRange: SourceRange
}

export interface TreeSpec {
  direction: 'LR'
  edges: TreeEdge[]
  sourceRange: SourceRange
}

export interface MindPptStructure {
  version: 0
  slides: SlideNode[]
  tree?: TreeSpec
}
