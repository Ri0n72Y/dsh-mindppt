import { describe, expect, it, vi } from 'vitest'

vi.mock('@excalidraw/excalidraw', () => ({
  convertToExcalidrawElements: (elements: unknown) => elements,
}))

import { createPlaygroundRuntime } from './runtime.ts'

const PATH = 'examples/assets/customer.svg'

function source(slideId: string, assetSource: string): string {
  return `mindppt

slide ${slideId} {
  layout two-column

  # Asset test

  right {
    ![Fixture](${assetSource})
  }
}
`
}

describe('playground snapshot asset consistency', () => {
  it('updates binary identity for changed same-path bytes without changing semantic image id', async () => {
    const files = {
      [PATH]: {
        mimeType: 'image/svg+xml' as const,
        dataURL: 'data:image/svg+xml,version-1',
      },
    }
    const initialSource = source('asset', './assets/customer.svg')
    const runtime = await createPlaygroundRuntime(initialSource, {
      documentPath: 'examples/asset.mindppt',
      files,
    })
    const first = runtime.getSnapshot()
    const firstImage = first.elements.find((element) => element.type === 'image')

    files[PATH] = {
      mimeType: 'image/svg+xml',
      dataURL: 'data:image/svg+xml,version-2',
    }
    runtime.setSource(initialSource)

    const replaced = runtime.getSnapshot()
    const replacedImage = replaced.elements.find(
      (element) => element.type === 'image',
    )
    expect(firstImage?.type).toBe('image')
    expect(replacedImage?.type).toBe('image')
    if (firstImage?.type !== 'image' || replacedImage?.type !== 'image') return

    expect(replacedImage.id).toBe(firstImage.id)
    expect(replacedImage.fileId).not.toBe(firstImage.fileId)
    expect(replacedImage.fileId).not.toBeNull()
    if (!replacedImage.fileId) return

    expect(replaced.files[replacedImage.fileId]?.dataURL).toBe(
      'data:image/svg+xml,version-2',
    )
  })

  it('publishes malformed asset paths as one warning-consistent logical version', async () => {
    const runtime = await createPlaygroundRuntime(
      source('before', './assets/customer.svg'),
      {
        documentPath: 'examples/asset.mindppt',
        files: {
          [PATH]: {
            mimeType: 'image/svg+xml',
            dataURL: 'data:image/svg+xml,version-1',
          },
        },
      },
    )
    const malformed = source('after', './assets/%E0%A4%A.png')

    expect(() => runtime.setSource(malformed)).not.toThrow()

    const snapshot = runtime.getSnapshot()
    expect(snapshot.source).toBe(malformed)
    expect(snapshot.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: 'Unable to resolve local asset path: ./assets/%E0%A4%A.png',
      }),
    ])
    expect(snapshot.files).toEqual({})
    expect(snapshot.camera.slideIds).toEqual(['after'])
    expect(snapshot.elements.some(
      (element) => element.id === 'slide:after/surface',
    )).toBe(true)
    expect(snapshot.elements.some(
      (element) => element.id === 'slide:before/surface',
    )).toBe(false)
  })

  it('keeps elements, files, and camera last-good on compile failure', async () => {
    const initialSource = source('before', './assets/customer.svg')
    const runtime = await createPlaygroundRuntime(initialSource, {
      documentPath: 'examples/asset.mindppt',
      files: {
        [PATH]: {
          mimeType: 'image/svg+xml',
          dataURL: 'data:image/svg+xml,version-1',
        },
      },
    })
    const lastGood = runtime.getSnapshot()
    const invalid = initialSource.replace(/\n}\n$/, '\n')

    runtime.setSource(invalid)
    const failed = runtime.getSnapshot()

    expect(failed.source).toBe(invalid)
    expect(failed.diagnostics[0]?.severity).toBe('error')
    expect(failed.elements).toBe(lastGood.elements)
    expect(failed.files).toBe(lastGood.files)
    expect(failed.camera).toEqual(lastGood.camera)
  })
})
