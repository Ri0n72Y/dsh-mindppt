import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@excalidraw/excalidraw', () => ({
  convertToExcalidrawElements: (elements: unknown) => elements,
}))

import { createPlaygroundRuntime } from './runtime.ts'

const documentPath = 'examples/mixed.mindppt'
const portraitPath = 'examples/assets/portrait.svg'
const brokenPath = 'examples/assets/broken.png'
const mixedSource = `mindppt
slide mixed {
  layout two-column
  # Mixed images
  left {
    ![Portrait](./assets/portrait.svg)
  }
  right {
    ![Broken](./assets/broken.png)
  }
}
`

function deferredDecodes() {
  const pending: Array<{
    src: string
    succeed: (width: number, height: number) => void
    fail: (error: string) => void
  }> = []
  vi.stubGlobal('Image', class {
    src = ''
    naturalWidth = 0
    naturalHeight = 0

    decode() {
      return new Promise<void>((resolve, reject) => {
        pending.push({
          src: this.src,
          succeed: (width, height) => {
            this.naturalWidth = width
            this.naturalHeight = height
            resolve()
          },
          fail: (error) => reject(new Error(error)),
        })
      })
    }
  })
  return pending
}

afterEach(() => vi.unstubAllGlobals())

describe('P3a mixed-asset decode readiness (Reviewer M1)', () => {
  it('paints valid portrait independently of corrupt image and reports only failed source', async () => {
    const pending = deferredDecodes()
    const runtime = await createPlaygroundRuntime(mixedSource, {
      documentPath,
      files: {
        [portraitPath]: {
          mimeType: 'image/svg+xml', dataURL: 'data:image/svg+xml,portrait',
        },
        [brokenPath]: {
          mimeType: 'image/png', dataURL: 'data:image/png,corrupt',
        },
      },
    })

    const initial = runtime.getSnapshot()
    expect(Object.keys(initial.files)).toHaveLength(2)
    expect(initial.elements.filter(e => e.type === 'image')).toHaveLength(0)
    expect(initial.elements.find(e => e.type === 'frame')?.children)
      .not.toContain('slide:mixed/left/image:0')
    expect(pending).toHaveLength(2)

    pending.find(entry => entry.src.includes('portrait'))!.succeed(100, 200)
    await vi.waitFor(() => {
      expect(runtime.getSnapshot().elements.filter(e => e.type === 'image'))
        .toEqual([expect.objectContaining({
          id: 'slide:mixed/left/image:0',
          x: 258.5, y: 176, width: 195, height: 390,
        })])
    })
    expect(runtime.getSnapshot().diagnostics).toEqual([])

    pending.find(entry => entry.src.includes('corrupt'))!.fail('invalid bitmap')
    await vi.waitFor(() => {
      const snapshot = runtime.getSnapshot()
      expect(snapshot.elements.filter(e => e.type === 'image'))
        .toEqual([expect.objectContaining({
          id: 'slide:mixed/left/image:0',
          width: 195, height: 390,
        })])
      expect(snapshot.diagnostics).toHaveLength(1)
      expect(snapshot.diagnostics[0]).toMatchObject({
        severity: 'error',
        message: expect.stringContaining('./assets/broken.png'),
        sourceRange: expect.any(Object),
      })
      const range = snapshot.diagnostics[0]!.sourceRange!
      expect(mixedSource.slice(range.start, range.end))
        .toBe('    ![Broken](./assets/broken.png)')
    })
  })

  it('withholds a new same-path file until decode; obsolete completion cannot reinsert it', async () => {
    const pending = deferredDecodes()
    const files = {
      [portraitPath]: {
        mimeType: 'image/svg+xml' as const,
        dataURL: 'data:image/svg+xml,old-portrait',
      },
    }
    const source = mixedSource.replace(
      /  right \{[\s\S]*?\n  \}/, '',
    )
    const runtime = await createPlaygroundRuntime(source, { documentPath, files })
    const oldId = Object.keys(runtime.getSnapshot().files)[0]!
    expect(runtime.getSnapshot().elements.some(e => e.type === 'image')).toBe(false)

    files[portraitPath] = {
      mimeType: 'image/svg+xml', dataURL: 'data:image/svg+xml,new-landscape',
    }
    runtime.setSource(source)
    const fresh = runtime.getSnapshot()
    const newId = Object.keys(fresh.files)[0]!
    expect(newId).not.toBe(oldId)
    expect(fresh.elements.some(e => e.type === 'image')).toBe(false)

    pending.find(entry => entry.src.includes('new-landscape'))!.succeed(400, 100)
    await vi.waitFor(() => {
      expect(runtime.getSnapshot().elements.find(e => e.type === 'image'))
        .toMatchObject({
          id: 'slide:mixed/left/image:0',
          fileId: newId, x: 96, y: 306, width: 520, height: 130,
        })
    })
    pending.find(entry => entry.src.includes('old-portrait'))!.succeed(100, 300)
    await Promise.resolve()
    expect(runtime.getSnapshot().elements.find(e => e.type === 'image'))
      .toMatchObject({ fileId: newId, x: 96, y: 306, width: 520, height: 130 })
  })
})
