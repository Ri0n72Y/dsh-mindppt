import { exportToCanvas } from '@excalidraw/excalidraw'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { SlideNode } from 'dsh-mindppt-code-parser'
import { PDFDocument } from 'pdf-lib'
import type { BrowserSnapshot, CompiledElements } from './runtime.ts'

const PAGE_WIDTH = 960
const PAGE_HEIGHT = 540
const IMAGE_SCALE = 2
const MAX_SLIDES = 20
const MAX_PNG_BYTES = 12 * 1024 * 1024
const MAX_TOTAL_PNG_BYTES = 80 * 1024 * 1024
const MAX_PDF_BYTES = 120 * 1024 * 1024

type Frame = Extract<CompiledElements[number], { type: 'frame' }>
type SceneElement = CompiledElements[number]

export interface ExportInput {
  slides: readonly SlideNode[]
  elements: CompiledElements
  files: BinaryFiles
  signal: AbortSignal
  ensureCurrent(): Promise<void>
  onProgress?(done: number, total: number): void
  rasterize?(page: SlidePage, files: BinaryFiles, signal: AbortSignal): Promise<Uint8Array>
}

export interface SlidePage {
  slide: SlideNode
  frame: Frame
  elements: SceneElement[]
}

export function assertExportable(snapshot: BrowserSnapshot): NonNullable<BrowserSnapshot['structure']> {
  if (!snapshot.structureCurrent || !snapshot.structure) {
    throw new Error('Cannot export: current MindPPT source does not compile')
  }
  if (snapshot.assetStatus === 'pending') {
    throw new Error('Cannot export: local images are still loading')
  }
  if (snapshot.assetStatus === 'failed') {
    throw new Error('Cannot export: one or more local images could not be loaded')
  }
  return snapshot.structure
}

export function selectSlidePage(
  slide: SlideNode,
  elements: CompiledElements,
): SlidePage {
  const frame = elements.find(
    (element): element is Frame =>
      element.type === 'frame' && element.id === 'slide:' + slide.id,
  )
  if (!frame) throw new Error('Slide frame unavailable: ' + slide.id)
  const children = elements.filter(element => !element.isDeleted && element.frameId === frame.id)
  if (!children.some(element => element.id === frame.id + '/surface')) {
    throw new Error('Slide surface unavailable: ' + slide.id)
  }
  return {
    slide,
    // Excalidraw's auto-calculated frame bounds include a padding halo.
    // Export geometry instead comes from the authoritative semantic slide box.
    frame: { ...frame, x: slide.x, y: slide.y, width: slide.width, height: slide.height },
    elements: children,
  }
}

export async function createSlidesPdf(input: ExportInput): Promise<Uint8Array> {
  const { slides, signal } = input
  if (slides.length === 0 || slides.length > MAX_SLIDES) {
    throw new Error('PDF export supports 1–' + MAX_SLIDES + ' slides')
  }
  const pdf = await PDFDocument.create()
  let totalPngBytes = 0
  for (const [index, slide] of slides.entries()) {
    signal.throwIfAborted()
    await input.ensureCurrent()
    const page = selectSlidePage(slide, input.elements)
    const png = await (input.rasterize ?? rasterizePage)(page, input.files, signal)
    signal.throwIfAborted()
    await input.ensureCurrent()
    totalPngBytes += png.byteLength
    if (png.byteLength > MAX_PNG_BYTES || totalPngBytes > MAX_TOTAL_PNG_BYTES) {
      throw new Error('PDF image budget exceeded; reduce slide count or image detail')
    }
    const image = await pdf.embedPng(png)
    const sheet = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    sheet.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT })
    input.onProgress?.(index + 1, slides.length)
  }
  signal.throwIfAborted()
  await input.ensureCurrent()
  const bytes = await pdf.save()
  signal.throwIfAborted()
  await input.ensureCurrent()
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error('PDF exceeds the 120 MiB output limit')
  return bytes
}

async function rasterizePage(
  page: SlidePage,
  files: BinaryFiles,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (page.slide.width !== 1280 || page.slide.height !== 720) {
    throw new Error('Unsupported slide geometry (expected 1280×720)')
  }
  signal.throwIfAborted()
  const canvas = await exportToCanvas({
    elements: page.elements as Parameters<typeof exportToCanvas>[0]['elements'],
    files,
    exportingFrame: page.frame,
    exportPadding: 0,
    appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
    getDimensions(width: number, height: number) {
      if (Math.round(width) !== 1280 || Math.round(height) !== 720) {
        throw new Error('PDF crop must match the 1280×720 semantic slide box')
      }
      return { width: width * IMAGE_SCALE, height: height * IMAGE_SCALE, scale: IMAGE_SCALE }
    },
  })
  try {
    signal.throwIfAborted()
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png')
    })
    signal.throwIfAborted()
    if (blob.size > MAX_PNG_BYTES) throw new Error('Slide PNG exceeds 12 MiB')
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
