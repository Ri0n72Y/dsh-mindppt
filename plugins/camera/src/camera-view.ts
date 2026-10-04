import type {
  MindPptStructure,
  PresentationPath,
} from 'dsh-mindppt-code-parser'

import type {
  CameraFocusRequest,
  CameraTarget,
  CameraView,
} from './types.ts'

export function createCameraView(
  structure: MindPptStructure | undefined,
  currentSlideId: string | undefined,
  selectedPathId: string | undefined,
  pathIndex: number | undefined,
  focusRequest: CameraFocusRequest | undefined,
): CameraView {
  const slide = currentSlideId
    ? structure?.slides.find(({ id }) => id === currentSlideId)
    : undefined
  const parentSlideId = currentSlideId
    ? structure?.tree?.edges.find(({ to }) => to === currentSlideId)?.from
    : undefined
  const path = selectedPathId
    ? structure?.paths?.find(({ id }) => id === selectedPathId)
    : undefined

  return {
    slideIds: structure?.slides.map(({ id }) => id) ?? [],
    childSlideIds: currentSlideId
      ? structure?.tree?.edges
        .filter(({ from }) => from === currentSlideId)
        .map(({ to }) => to) ?? []
      : [],
    pathOptions: structure?.paths?.map(({ id, name }) => ({ id, name })) ?? [],
    outgoingSoftLinks: currentSlideId
      ? structure?.links
        ?.filter(({ fromSlideId }) => fromSlideId === currentSlideId)
        .map(({ id, toSlideId }) => ({ id, targetSlideId: toSlideId })) ?? []
      : [],
    canPathPrevious: Boolean(path && pathIndex !== undefined && pathIndex > 0),
    canPathNext: hasNextOccurrence(path, pathIndex),
    ...(currentSlideId ? { currentSlideId } : {}),
    ...(slide ? { target: toCameraTarget(slide) } : {}),
    ...(parentSlideId ? { parentSlideId } : {}),
    ...(path ? { selectedPathId: path.id } : {}),
    ...(path && pathIndex !== undefined
      ? {
          currentPathOccurrenceIndex: pathIndex,
          currentPathOccurrenceCount: path.occurrences.length,
        }
      : {}),
    ...(focusRequest ? { focusRequest } : {}),
  }
}

function hasNextOccurrence(
  path: PresentationPath | undefined,
  index: number | undefined,
): boolean {
  return Boolean(
    path
    && index !== undefined
    && index + 1 < path.occurrences.length,
  )
}

function toCameraTarget(
  slide: MindPptStructure['slides'][number],
): CameraTarget {
  return {
    slideId: slide.id,
    x: slide.x,
    y: slide.y,
    width: slide.width,
    height: slide.height,
  }
}
