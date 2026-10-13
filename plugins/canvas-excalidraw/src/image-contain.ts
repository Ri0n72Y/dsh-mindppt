import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'

export interface ImageDimensions {
  width: number
  height: number
}

// Visual projection only: compiler-owned semantic geometry is never changed.
export function containImages(
  scene: readonly ExcalidrawElementSkeleton[],
  dimensions: Readonly<Record<string, ImageDimensions>>,
): ExcalidrawElementSkeleton[] {
  return scene.map(element => {
    if (element.type !== 'image' || !element.id) return element
    const image = dimensions[element.id]
    if (!image || !validSize(image.width, image.height)
      || !validSize(element.width, element.height)) return element
    const scale = Math.min(element.width / image.width, element.height / image.height)
    const width = image.width * scale
    const height = image.height * scale
    return {
      ...element,
      x: element.x + (element.width - width) / 2,
      y: element.y + (element.height - height) / 2,
      width,
      height,
    }
  })
}

export function validSize(width: number, height: number): boolean {
  return Number.isFinite(width) && width > 0
    && Number.isFinite(height) && height > 0
}
