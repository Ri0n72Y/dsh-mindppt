import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  MindPptStructure,
  SlideNode,
  SoftLink,
} from 'dsh-mindppt-code-parser'

export function renderSoftLinkScene(
  structure: MindPptStructure,
): ExcalidrawElementSkeleton[] {
  return (structure.links ?? []).map((link) => renderSoftLink(structure, link))
}

function renderSoftLink(
  structure: MindPptStructure,
  link: SoftLink,
): ExcalidrawElementSkeleton {
  const source = structure.slides.find(
    (slide) => slide.id === link.fromSlideId,
  )
  const target = structure.slides.find(
    (slide) => slide.id === link.toSlideId,
  )

  if (!source || !target) {
    throw new Error('Resolved SoftLink references missing slide: ' + link.id)
  }

  const start = boundaryPoint(source, target)
  const end = boundaryPoint(target, source)

  return {
    type: 'arrow',
    id: link.id,
    x: start.x,
    y: start.y,
    points: [
      [0, 0],
      [end.x - start.x, end.y - start.y],
    ],
    endArrowhead: 'arrow',
    strokeStyle: 'dashed',
    strokeWidth: 2,
    roughness: 0,
  }
}

function boundaryPoint(
  source: SlideNode,
  target: SlideNode,
): { x: number; y: number } {
  const sourceX = source.x + source.width / 2
  const sourceY = source.y + source.height / 2
  const targetX = target.x + target.width / 2
  const targetY = target.y + target.height / 2
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const horizontal = dx === 0
    ? Number.POSITIVE_INFINITY
    : (source.width / 2) / Math.abs(dx)
  const vertical = dy === 0
    ? Number.POSITIVE_INFINITY
    : (source.height / 2) / Math.abs(dy)
  const scale = Math.min(horizontal, vertical)

  return {
    x: sourceX + dx * scale,
    y: sourceY + dy * scale,
  }
}
