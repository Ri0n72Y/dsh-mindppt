import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  MindPptStructure,
  SlideNode,
  TreeEdge,
} from 'dsh-mindppt-code-parser'

export type ExcalidrawScene = ExcalidrawElementSkeleton[]

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
  const shadow: ExcalidrawElementSkeleton = {
    type: 'rectangle',
    id: `slide:${slide.id}/shadow`,
    x: slide.x + 18,
    y: slide.y + 18,
    width: slide.width,
    height: slide.height,
    backgroundColor: '#000000',
    strokeColor: 'transparent',
    fillStyle: 'solid',
    opacity: 14,
    roughness: 0,
  }

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

  const content: ExcalidrawElementSkeleton[] = slide.elements.map((element) => ({
    type: 'text',
    id: element.id,
    x: slide.x + element.x + element.width / 2,
    y: slide.y + element.y + element.height / 2,
    text: element.text,
    fontSize: 72,
    textAlign: 'center',
    verticalAlign: 'middle',
  }))

  const frame: ExcalidrawElementSkeleton = {
    type: 'frame',
    id: `slide:${slide.id}`,
    children: [surface, ...content].flatMap((child) =>
      child.id ? [child.id] : [],
    ),
    name: slide.id,
  }

  return [shadow, surface, ...content, frame]
}
