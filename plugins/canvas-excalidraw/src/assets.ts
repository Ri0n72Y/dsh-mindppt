import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  MindPptStructure,
  SourceRange,
} from 'dsh-mindppt-code-parser'

type ImageFileId = Extract<
  ExcalidrawElementSkeleton,
  { type: 'image' }
>['fileId']

export interface CanvasAssetRequest {
  fileId: ImageFileId
  source: string
  sourceRange: SourceRange
}

export function collectAssetRequests(
  structure: MindPptStructure,
): CanvasAssetRequest[] {
  const requests: CanvasAssetRequest[] = []
  const seen = new Set<string>()

  for (const slide of structure.slides) {
    for (const element of slide.elements) {
      if (element.kind !== 'image') continue

      const fileId = imageFileId(element.src)
      if (seen.has(fileId)) continue
      seen.add(fileId)
      requests.push({
        fileId,
        source: element.src,
        sourceRange: element.sourceRange,
      })
    }
  }

  return requests
}

export function imageFileId(source: string): ImageFileId {
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return ('mindppt-' + (hash >>> 0).toString(16).padStart(8, '0')) as ImageFileId
}
