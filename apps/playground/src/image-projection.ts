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
  const scene = containImages(canvasService.scene, dimensions).flatMap(element => {
    if (element.type !== 'image' || !element.id) return [element]
    const fileId = assets?.elementFileIds[element.id]
    const size = dimensions[element.id]
    // Unknown/failed images must never paint stretched in their semantic slot.
    return fileId && size && validSize(size.width, size.height)
      ? [{ ...element, fileId }] : []
  })
  return convertToExcalidrawElements(scene, { regenerateIds: false })
}

export type ImageDecodeResult =
  | { size: ImageDimensions; error?: never }
  | { error: string; size?: never }

export async function decodeImageDimensions(
  assets: ResolvedAssets,
  onResult: (elementId: string, fileId: string, result: ImageDecodeResult) => void,
): Promise<void> {
  const pending = new Map<string, Promise<ImageDimensions>>()
  await Promise.all(Object.entries(assets.elementFileIds).map(async ([id, fileId]) => {
    const data = assets.files[fileId]
    if (!data) return
    let decoded = pending.get(fileId)
    if (!decoded) {
      decoded = decodeImage(data.dataURL, fileId)
      pending.set(fileId, decoded)
    }
    try {
      const size = await decoded
      onResult(id, fileId, { size })
    } catch (error) {
      onResult(id, fileId, { error: String(error) })
    }
  }))
}

async function decodeImage(dataURL: string, fileId: string): Promise<ImageDimensions> {
  const image = new Image()
  image.src = dataURL
  await image.decode()
  if (!validSize(image.naturalWidth, image.naturalHeight)) {
    throw new Error('Invalid intrinsic image dimensions: ' + fileId)
  }
  return { width: image.naturalWidth, height: image.naturalHeight }
}

export function retainImageDimensions(
  assets: ResolvedAssets | undefined,
  knownSizes: ReadonlyMap<string, ImageDimensions>,
): Readonly<Record<string, ImageDimensions>> {
  return Object.fromEntries(
    Object.entries(assets?.elementFileIds ?? {}).flatMap(([id, fileId]) => {
      const size = knownSizes.get(fileId)
      return size ? [[id, size]] : []
    }),
  )
}
