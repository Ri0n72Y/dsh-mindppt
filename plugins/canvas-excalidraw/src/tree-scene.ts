import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  MindPptStructure,
  SlideNode,
  TreeDirection,
  TreeEdge,
} from 'dsh-mindppt-code-parser'

export function renderTreeScene(
  structure: MindPptStructure,
): ExcalidrawElementSkeleton[] {
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
    throw new Error('Resolved tree edge references missing slide: ' + edge.id)
  }

  const [start, end] = treeEdgeEndpoints(
    structure.tree?.direction ?? 'LR',
    source,
    target,
  )

  return {
    type: 'arrow',
    id: edge.id,
    x: start.x,
    y: start.y,
    points: [
      [0, 0],
      [end.x - start.x, end.y - start.y],
    ],
    endArrowhead: 'arrow',
    strokeWidth: 2,
  }
}

function treeEdgeEndpoints(
  direction: TreeDirection,
  source: SlideNode,
  target: SlideNode,
): [{ x: number; y: number }, { x: number; y: number }] {
  switch (direction) {
    case 'LR':
      return [
        { x: source.x + source.width, y: source.y + source.height / 2 },
        { x: target.x, y: target.y + target.height / 2 },
      ]
    case 'RL':
      return [
        { x: source.x, y: source.y + source.height / 2 },
        { x: target.x + target.width, y: target.y + target.height / 2 },
      ]
    case 'TB':
    case 'TD':
      return [
        { x: source.x + source.width / 2, y: source.y + source.height },
        { x: target.x + target.width / 2, y: target.y },
      ]
    case 'BT':
      return [
        { x: source.x + source.width / 2, y: source.y },
        { x: target.x + target.width / 2, y: target.y + target.height },
      ]
  }
}
