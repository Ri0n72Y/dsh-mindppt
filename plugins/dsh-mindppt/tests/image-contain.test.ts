import { describe, expect, it, vi } from 'vitest'
import { BrowserMindPptRuntime, type BrowserSnapshot } from '../src/client/runtime.ts'
import { assertExportable } from '../src/client/pdf-export.ts'

vi.mock('@excalidraw/excalidraw', () => ({
  convertToExcalidrawElements: (elements: unknown) => elements,
}))

const source = `mindppt
slide asset {
  layout two-column
  # Image
  left {
    ![Changing](./image.svg)
  }
}
`

async function settled(runtime: BrowserMindPptRuntime): Promise<BrowserSnapshot> {
  if (runtime.getSnapshot().assetStatus !== 'pending') return runtime.getSnapshot()
  return new Promise(resolve => {
    const unsub = runtime.subscribe(() => {
      const next = runtime.getSnapshot()
      if (next.assetStatus === 'pending') return
      unsub()
      resolve(next)
    })
  })
}

describe('P3a DSH image dimensions and PDF shared projection', () => {
  it('centers decoded images; new bytes and dimensions replace same-path geometry', async () => {
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
      naturalWidth = 0
      naturalHeight = 0
      async decode() {
        const marker = Buffer.from(this.src.split(',')[1]!, 'base64').toString()
        if (marker === 'broken') throw new Error('invalid image')
        this.naturalWidth = marker === 'portrait' ? 100 : 400
        this.naturalHeight = marker === 'portrait' ? 200 : 100
      }
    })

    let bytes = 'portrait'
    const readRelated = vi.fn(async () => ({
      data: new TextEncoder().encode(bytes),
      mimeType: 'image/svg+xml' as const,
    }))
    try {
      const runtime = await BrowserMindPptRuntime.create(source, readRelated)
      const first = await settled(runtime)
      const firstImage = first.elements.find(e => e.type === 'image')!
      expect(assertExportable(first).slides).toHaveLength(1)
      expect(firstImage).toMatchObject({
        id: 'slide:asset/left/image:0',
        x: 258.5, y: 176, width: 195, height: 390,
      })
      expect(first.structure?.slides[0]?.elements.find(e => e.kind === 'image'))
        .toMatchObject({
          x: 96, y: 176, width: 520, height: 390,
          sourceRange: expect.any(Object),
        })

      bytes = 'landscape'
      runtime.setSource(source)
      const replaced = await settled(runtime)
      const nextImage = replaced.elements.find(e => e.type === 'image')!
      expect(nextImage).toMatchObject({
        id: firstImage.id,
        x: 96, y: 306, width: 520, height: 130,
      })
      expect(nextImage.fileId).not.toBe(firstImage.fileId)
      expect(assertExportable(replaced).slides).toHaveLength(1)
      expect(replaced.diagnostics).toEqual([])

      bytes = 'broken'
      runtime.setSource(source)
      const broken = await settled(runtime)
      expect(broken.assetStatus).toBe('failed')
      expect(() => assertExportable(broken)).toThrow('could not be loaded')
      expect(broken.diagnostics[0]?.message).toContain('could not be decoded')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
