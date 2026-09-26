export interface TextNode {
  kind: 'title'
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
}

export interface SlideNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  elements: TextNode[]
}

export interface MindPptStructure {
  version: 0
  slides: SlideNode[]
}
