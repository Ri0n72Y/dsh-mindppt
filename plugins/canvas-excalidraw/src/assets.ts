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
  elementIds: string[]
  source: string
  sourceRange: SourceRange
}

export function collectAssetRequests(
  structure: MindPptStructure,
): CanvasAssetRequest[] {
  const requests = new Map<string, CanvasAssetRequest>()

  for (const slide of structure.slides) {
    for (const element of slide.elements) {
      if (element.kind !== 'image') continue

      const existing = requests.get(element.src)
      if (existing) {
        existing.elementIds.push(element.id)
        continue
      }

      requests.set(element.src, {
        elementIds: [element.id],
        source: element.src,
        sourceRange: element.sourceRange,
      })
    }
  }

  return [...requests.values()]
}

export function semanticImageFileId(elementId: string): ImageFileId {
  return ('mindppt-semantic:' + elementId) as ImageFileId
}
