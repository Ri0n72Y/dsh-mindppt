import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { ContentNode, SlideNode } from 'dsh-mindppt-code-parser'

export type ExtensionNode = Extract<ContentNode, { kind: 'extension' }>

export interface ExtensionRenderContext {
  slide: SlideNode
  element: ExtensionNode
}

export type ExtensionRenderer = (
  context: ExtensionRenderContext,
) => ExcalidrawElementSkeleton[]
