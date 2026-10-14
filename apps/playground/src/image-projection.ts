import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import MindPptCanvasService, {
  containImages, validSize, type ImageDimensions,
} from 'dsh-mindppt-canvas-excalidraw'
import type { ResolvedAssets } from './assets.ts'

export type CompiledElements = ReturnType<typeof convertToExcalidrawElements>

export function compileElements(
  canvasService: MindPptCanvasService,
  assets: ResolvedAssets | undefined,
  dimensions: Readonly<Record<string, ImageDimensions>>,
): CompiledElements {
  const scene = containImages(canvasService.scene, dimensions).map((element) => {
    if (element.type !== 'image' || !element.id) return element
    const fileId = assets?.elementFileIds[element.id]
    return fileId ? { ...element, fileId } : element
  })
  return convertToExcalidrawElements(scene, { regenerateIds: false })
}

export async function decodeImageDimensions(
  assets: ResolvedAssets,
): Promise<Readonly<Record<string, ImageDimensions>>> {
  const dimensions: Record<string, ImageDimensions> = {}
  const decoded = new Map<string, ImageDimensions>()
  for (const [elementId, fileId] of Object.entries(assets.elementFileIds)) {
    let size = decoded.get(fileId)
    if (!size) {
      const data = assets.files[fileId]
      if (!data) continue
      const image = new Image()
      image.src = data.dataURL
      await image.decode()
      if (!validSize(image.naturalWidth, image.naturalHeight)) {
        throw new Error('Invalid intrinsic image dimensions: ' + fileId)
      }
      size = { width: image.naturalWidth, height: image.naturalHeight }
      decoded.set(fileId, size)
    }
    dimensions[elementId] = size
  }
  return dimensions
}

export function retainImageDimensions(
  previous: ResolvedAssets | undefined,
  next: ResolvedAssets | undefined,
  dimensions: Readonly<Record<string, ImageDimensions>>,
): Readonly<Record<string, ImageDimensions>> {
  return Object.fromEntries(
    Object.entries(next?.elementFileIds ?? {}).flatMap(([id, fileId]) => {
      const size = dimensions[id]
      return size && previous?.elementFileIds[id] === fileId ? [[id, size]] : []
    }),
  )
}
