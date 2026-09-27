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
    type: 'rectangle',
    id: `${element.id}/box`,
    x: slide.x + element.x,
    y: slide.y + element.y,
    width: element.width,
    height: element.height,
    backgroundColor: 'transparent',
    strokeColor: 'transparent',
    roughness: 0,
    label: {
      id: element.id,
      text: element.text,
      fontSize: 72,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: '#1b1b1f',
    },
  }))

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
