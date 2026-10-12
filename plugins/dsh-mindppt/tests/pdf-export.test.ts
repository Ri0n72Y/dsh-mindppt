import { PDFDocument } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { assertExportable, createSlidesPdf, selectSlidePage } from '../src/client/pdf-export.ts'
import { pdfFilename } from '../src/client/PdfExportAction.tsx'
import type { BrowserSnapshot } from '../src/client/runtime.ts'

vi.mock('@excalidraw/excalidraw', () => ({ exportToCanvas: vi.fn() }))

const png = new Uint8Array(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==',
  'base64',
))
const slides = ['second', 'first'].map((id, index) => ({
  id, x: index * 1880, y: 0, width: 1280, height: 720,
  elements: [], sourceRange: { start: index, end: index + 1 },
}))
const elements = [
  { id: 'slide:second', type: 'frame', x: 0, y: 0, width: 1300, height: 740 },
  { id: 'slide:second/surface', type: 'rectangle', frameId: 'slide:second' },
  { id: 'second/title/box', type: 'rectangle', frameId: 'slide:second' },
  { id: 'tree:second-first', type: 'arrow', frameId: null },
  { id: 'link:second-first', type: 'line', frameId: null },
  { id: 'slide:first', type: 'frame', x: 1880, y: 0, width: 1300, height: 740 },
  { id: 'slide:first/surface', type: 'rectangle', frameId: 'slide:first' },
  { id: 'first/chart/bar/box', type: 'rectangle', frameId: 'slide:first' },
] as never
const signal = new AbortController().signal

describe('MindPPT slide PDF export', () => {
  it('selects only actual slide descendants, clips by semantic bounds', () => {
    const page = selectSlidePage(slides[0]!, elements)
    expect(page.frame).toMatchObject({ x: 0, y: 0, width: 1280, height: 720 })
    expect(page.elements.map(element => element.id)).toEqual([
      'slide:second/surface', 'second/title/box',
    ])
    expect(selectSlidePage(slides[1]!, elements).elements.map(e => e.id)).toEqual([
      'slide:first/surface', 'first/chart/bar/box',
    ])
  })

  it('uses declaration order, exactly one 960×540 PDF page per slide', async () => {
    const rendered: string[] = []
    const ensureCurrent = vi.fn(async () => {})
    const pdf = await createSlidesPdf({
      slides, elements, files: {}, signal, ensureCurrent,
      async rasterize(page) { rendered.push(page.slide.id); return png },
    })
    expect(rendered).toEqual(['second', 'first'])
    expect(ensureCurrent.mock.calls.length).toBeGreaterThanOrEqual(slides.length * 2)
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPages().map(page => page.getSize())).toEqual([
      { width: 960, height: 540 }, { width: 960, height: 540 },
    ])
  })

  it('rejects invalid, pending, and missing images instead of stale content', () => {
    const valid = { structureCurrent: true, structure: { slides }, assetStatus: 'ready' }
    expect(() => assertExportable({ ...valid, structureCurrent: false } as BrowserSnapshot)).toThrow('does not compile')
    expect(() => assertExportable({ ...valid, assetStatus: 'pending' } as BrowserSnapshot)).toThrow('still loading')
    expect(() => assertExportable({ ...valid, assetStatus: 'failed' } as BrowserSnapshot)).toThrow('could not be loaded')
    expect(() => assertExportable(valid as BrowserSnapshot)).not.toThrow()
  })

  it('rejects changed source and aborted exports before returning bytes', async () => {
    const changed = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new Error('version changed'))
    await expect(createSlidesPdf({
      slides, elements, files: {}, signal, ensureCurrent: changed,
      async rasterize() { return png },
    })).rejects.toThrow('version changed')
    const controller = new AbortController()
    controller.abort()
    await expect(createSlidesPdf({
      slides, elements, files: {}, signal: controller.signal,
      ensureCurrent: async () => {}, async rasterize() { return png },
    })).rejects.toThrow()
  })

  it('uses a safe filename without modifying Workspace', () => {
    expect(pdfFilename('C:\\folder\\季度报告.mindppt')).toBe('季度报告.pdf')
    expect(pdfFilename('../some:danger?name.mindppt')).toBe('some_danger_name.pdf')
    expect(pdfFilename('...mindppt')).toBe('presentation.pdf')
  })
})
