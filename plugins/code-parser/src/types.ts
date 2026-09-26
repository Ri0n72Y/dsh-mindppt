export interface SourceRange {
  start: number
  end: number
}

export interface TextNode {
  kind: 'title'
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  sourceRange: SourceRange
}

export interface SlideNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  elements: TextNode[]
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
