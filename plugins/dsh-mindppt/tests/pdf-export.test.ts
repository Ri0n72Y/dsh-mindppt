import { PDFDocument } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { assertExportable, createSlidesPdf, selectSlidePage } from '../src/client/pdf-export.ts'
import { pdfFilename } from '../src/client/PdfExportAction.tsx'
import { BrowserMindPptRuntime, type BrowserSnapshot } from '../src/client/runtime.ts'

vi.mock('@excalidraw/excalidraw', () => ({
  exportToCanvas: vi.fn(),
  convertToExcalidrawElements: (scene: unknown[]) => scene,
}))

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
    expect(() => assertExportable({ ...valid, structureCurrent: false } as unknown as BrowserSnapshot)).toThrow('does not compile')
    expect(() => assertExportable({ ...valid, assetStatus: 'pending' } as unknown as BrowserSnapshot)).toThrow('still loading')
    expect(() => assertExportable({ ...valid, assetStatus: 'failed' } as unknown as BrowserSnapshot)).toThrow('could not be loaded')
    expect(() => assertExportable(valid as unknown as BrowserSnapshot)).not.toThrow()
  })


  it('blocks PDF export when read-successful PNG/SVG bytes fail browser decoding', async () => {
    const decoded: string[] = []
    vi.stubGlobal('FileReader', class {
      result = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      readAsDataURL(blob: Blob) {
        void blob.arrayBuffer().then(bytes => {
          this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`
          this.onload?.()
        })
      }
    })
    vi.stubGlobal('Image', class {
      src = ''
      decode() {
        decoded.push(this.src)
        return Promise.reject(new Error('Browser cannot decode image'))
      }
    })

    try {
      for (const [path, mimeType, data] of [
        ['./broken.png', 'image/png', new Uint8Array([0, 1, 2, 3])],
        ['./broken.svg', 'image/svg+xml', new TextEncoder().encode('<svg><bad>')],
      ] as const) {
        const readRelated = vi.fn(async () => ({ data, mimeType }))
        const runtime = await BrowserMindPptRuntime.create(
          `mindppt\nslide demo {\n  ![broken](${path})\n}\n`,
          readRelated,
        )
        const settled = await new Promise<BrowserSnapshot>(resolve => {
          const initial = runtime.getSnapshot()
          if (initial.assetStatus !== 'pending') {
            resolve(initial)
            return
          }
          const unsubscribe = runtime.subscribe(() => {
            const next = runtime.getSnapshot()
            if (next.assetStatus !== 'pending') {
              unsubscribe()
              resolve(next)
            }
          })
        })

        expect(readRelated).toHaveBeenCalledOnce()
        expect(settled.structureCurrent).toBe(true)
        expect(settled.assetStatus).toBe('failed')
        expect(settled.diagnostics).toEqual(expect.arrayContaining([
          expect.objectContaining({
            severity: 'error',
            message: expect.stringContaining('Local image could not be decoded: ' + path),
          }),
        ]))
        // PdfExportAction checks this before rasterization or browser download.
        expect(() => assertExportable(settled)).toThrow('could not be loaded')
      }
      expect(decoded).toHaveLength(2)
      expect(decoded[0]).toMatch(/^data:image\/png;base64,/)
      expect(decoded[1]).toMatch(/^data:image\/svg\+xml;base64,/)
    } finally {
      vi.unstubAllGlobals()
    }
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
