import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  ContentNode,
  MindPptStructure,
  SlideNode,
  TreeEdge,
} from 'dsh-mindppt-code-parser'

export type ExcalidrawScene = ExcalidrawElementSkeleton[]

// Excalidraw 0.18 EXCALIDRAW_SYSTEM_FONT_FAMILY. Kept local so the renderer does not
// pull the browser runtime into Node-based tests just to access an enum value.
const EXCALIDRAW_SYSTEM_FONT_FAMILY = 2

export function renderScene(structure: MindPptStructure): ExcalidrawScene {
  return [
    ...renderTree(structure),
    ...structure.slides.flatMap(renderSlide),
  ]
}

function renderTree(structure: MindPptStructure): ExcalidrawScene {
  if (!structure.tree) return []
  return structure.tree.edges.map((edge) => renderTreeEdge(structure, edge))
}

function renderTreeEdge(
  structure: MindPptStructure,
  edge: TreeEdge,
): ExcalidrawElementSkeleton {
  const source = structure.slides.find((slide) => slide.id === edge.from)
  const target = structure.slides.find((slide) => slide.id === edge.to)

  if (!source || !target) {
    throw new Error(`Resolved tree edge references missing slide: ${edge.id}`)
  }

  const x = source.x + source.width
  const y = source.y + source.height / 2
  const targetX = target.x
  const targetY = target.y + target.height / 2

  return {
    type: 'arrow',
    id: edge.id,
    x,
    y,
    points: [
      [0, 0],
      [targetX - x, targetY - y],
    ],
    endArrowhead: 'arrow',
    strokeWidth: 2,
  }
}

function renderSlide(slide: SlideNode): ExcalidrawScene {
  const surface: ExcalidrawElementSkeleton = {
    type: 'rectangle',
    id: `slide:${slide.id}/surface`,
    x: slide.x,
    y: slide.y,
    width: slide.width,
    height: slide.height,
    backgroundColor: '#ffffff',
    strokeColor: '#d0d0d0',
    fillStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
  }

  const content = slide.elements.flatMap((element) =>
    renderContent(slide, element),
  )

  const frame: ExcalidrawElementSkeleton = {
    type: 'frame',
    id: `slide:${slide.id}`,
    children: [surface, ...content].flatMap((child) =>
      child.id ? [child.id] : [],
    ),
    name: slide.id,
  }

  return [surface, ...content, frame]
}

function renderContent(
  slide: SlideNode,
  element: ContentNode,
): ExcalidrawScene {
  if (element.kind === 'extension') {
    return renderExtensionFallback(slide, element)
  }

  return [
    {
      type: 'rectangle',
      id: `${element.id}/box`,
      x: slide.x + element.x,
      y: slide.y + element.y,
      width: element.width,
      height: element.height,
      backgroundColor: 'transparent',
      strokeColor: 'transparent',
      fillStyle: 'solid',
      roughness: 0,
      label: {
        text: contentText(element),
        fontSize: contentFontSize(element),
        textAlign:
          element.kind === 'title' || element.kind === 'subtitle'
            ? 'center'
            : 'left',
        verticalAlign:
          element.kind === 'title' || element.kind === 'subtitle'
            ? 'middle'
            : 'top',
        strokeColor: '#1b1b1f',
      },
    },
  ]
}

function renderExtensionFallback(
  slide: SlideNode,
  element: Extract<ContentNode, { kind: 'extension' }>,
): ExcalidrawScene {
  const x = slide.x + element.x
  const y = slide.y + element.y
  const text = contentText(element)

  return [
    {
      type: 'rectangle',
      id: `${element.id}/box`,
      x,
      y,
      width: element.width,
      height: element.height,
      backgroundColor: '#f8f9fa',
      strokeColor: '#adb5bd',
      strokeStyle: 'dashed',
      fillStyle: 'solid',
      roughness: 0,
    },
    {
      type: 'text',
      id: `${element.id}/text`,
      x: x + 16,
      y: y + 16,
      text,
      fontSize: contentFontSize(element),
      fontFamily: EXCALIDRAW_SYSTEM_FONT_FAMILY,
      textAlign: 'left',
      verticalAlign: 'top',
      strokeColor: '#1b1b1f',
    },
  ]
}

function contentText(element: ContentNode): string {
  if (element.kind === 'list') {
    return element.items
      .map((item, index) =>
        element.ordered ? `${index + 1}. ${item}` : `• ${item}`,
      )
      .join('\n')
  }

  if (element.kind === 'extension') {
    return `[${element.type || 'extension'}]\n${element.raw}`
  }

  return element.text
}

function contentFontSize(element: ContentNode): number {
  switch (element.kind) {
    case 'title':
      return 48
    case 'subtitle':
      return 30
    case 'text':
    case 'list':
      return 24
    case 'extension':
      return 22
  }
}

