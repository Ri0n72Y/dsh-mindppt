import { describe, expect, it } from 'vitest'

import type { CanvasAssetRequest } from 'dsh-mindppt-canvas-excalidraw'

import { resolveCanvasAssets } from './assets.ts'

const DOCUMENT_PATH = 'examples/m6-two-column.mindppt'

function request(
  source: string,
  elementId = 'slide:customer/right/image:0',
): CanvasAssetRequest {
  return {
    elementIds: [elementId],
    source,
    sourceRange: { start: 10, end: 42 },
  }
}

describe('playground local asset resolution', () => {
  it('resolves image data relative to the MindPPT document path', () => {
    const result = resolveCanvasAssets(
      [request('./assets/customer.svg')],
      {
        documentPath: DOCUMENT_PATH,
        files: {
          'examples/assets/customer.svg': {
            mimeType: 'image/svg+xml',
            dataURL: 'data:image/svg+xml,%3Csvg%2F%3E',
          },
        },
      },
    )

    const fileId = result.elementFileIds['slide:customer/right/image:0']
    expect(result.diagnostics).toEqual([])
    expect(fileId).toBeDefined()
    expect(Object.keys(result.files)).toEqual([fileId])
    expect(result.files[fileId!]).toEqual(expect.objectContaining({
      id: fileId,
      mimeType: 'image/svg+xml',
      dataURL: 'data:image/svg+xml,%3Csvg%2F%3E',
      created: 0,
    }))
  })

  it('keeps unchanged bytes stable and changes binary identity with same-path bytes', () => {
    const files = {
      'examples/assets/customer.svg': {
        mimeType: 'image/svg+xml' as const,
        dataURL: 'data:image/svg+xml,version-1',
      },
    }
    const context = { documentPath: DOCUMENT_PATH, files }
    const assetRequest = request('./assets/customer.svg')

    const first = resolveCanvasAssets([assetRequest], context)
    const unchanged = resolveCanvasAssets([assetRequest], context)
    const firstId = first.elementFileIds[assetRequest.elementIds[0]!]

    expect(unchanged.elementFileIds[assetRequest.elementIds[0]!]).toBe(firstId)

    files['examples/assets/customer.svg'] = {
      mimeType: 'image/svg+xml',
      dataURL: 'data:image/svg+xml,version-2',
    }
    const replaced = resolveCanvasAssets([assetRequest], context)
    const replacedId = replaced.elementFileIds[assetRequest.elementIds[0]!]

    expect(replacedId).not.toBe(firstId)
    expect(replaced.files[replacedId!]?.dataURL).toBe(
      'data:image/svg+xml,version-2',
    )
  })

  it('does not collapse known 32-bit source collisions', () => {
    const firstSource = './assets/72p9kvztbry2.png'
    const secondSource = './assets/9035ngs4mk8m.png'
    const firstElement = 'slide:collision/left/image:0'
    const secondElement = 'slide:collision/right/image:0'
    const result = resolveCanvasAssets(
      [request(firstSource, firstElement), request(secondSource, secondElement)],
      {
        documentPath: 'examples/collision.mindppt',
        files: {
          'examples/assets/72p9kvztbry2.png': {
            mimeType: 'image/png',
            dataURL: 'data:image/png;base64,Zmlyc3Q=',
          },
          'examples/assets/9035ngs4mk8m.png': {
            mimeType: 'image/png',
            dataURL: 'data:image/png;base64,c2Vjb25k',
          },
        },
      },
    )

    const firstId = result.elementFileIds[firstElement]
    const secondId = result.elementFileIds[secondElement]
    expect(firstId).toBeDefined()
    expect(secondId).toBeDefined()
    expect(firstId).not.toBe(secondId)
    expect(Object.keys(result.files)).toHaveLength(2)
    expect(result.files[firstId!]?.dataURL).toContain('Zmlyc3Q=')
    expect(result.files[secondId!]?.dataURL).toContain('c2Vjb25k')
  })

  it('turns malformed local paths into warnings without throwing', () => {
    const malformed = resolveCanvasAssets(
      [request('./assets/%E0%A4%A.png')],
      { documentPath: DOCUMENT_PATH, files: {} },
    )

    expect(malformed.files).toEqual({})
    expect(malformed.elementFileIds).toEqual({})
    expect(malformed.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: 'Unable to resolve local asset path: ./assets/%E0%A4%A.png',
      }),
    ])
  })

  it('does not reuse stale binary identity after removal and changed re-add', () => {
    const path = 'examples/assets/customer.svg'
    const files: Record<string, {
      mimeType: 'image/svg+xml'
      dataURL: string
    }> = {
      [path]: {
        mimeType: 'image/svg+xml',
        dataURL: 'data:image/svg+xml,version-1',
      },
    }
    const context = { documentPath: DOCUMENT_PATH, files }
    const assetRequest = request('./assets/customer.svg')
    const first = resolveCanvasAssets([assetRequest], context)
    const firstId = first.elementFileIds[assetRequest.elementIds[0]!]

    delete files[path]
    const removed = resolveCanvasAssets([assetRequest], context)
    expect(removed.files).toEqual({})
    expect(removed.diagnostics[0]?.message).toBe(
      'Local asset not found: ./assets/customer.svg',
    )

    files[path] = {
      mimeType: 'image/svg+xml',
      dataURL: 'data:image/svg+xml,version-2',
    }
    const readded = resolveCanvasAssets([assetRequest], context)
    const readdedId = readded.elementFileIds[assetRequest.elementIds[0]!]

    expect(readdedId).not.toBe(firstId)
    expect(readded.files[readdedId!]?.dataURL).toBe(
      'data:image/svg+xml,version-2',
    )
  })

  it('reports missing and non-local assets without throwing', () => {
    const context = {
      documentPath: DOCUMENT_PATH,
      files: {},
    }

    const missing = resolveCanvasAssets(
      [request('./assets/missing.svg')],
      context,
    )
    expect(missing.files).toEqual({})
    expect(missing.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: 'Local asset not found: ./assets/missing.svg',
        sourceRange: { start: 10, end: 42 },
      }),
    ])

    const remote = resolveCanvasAssets(
      [request('https://example.com/customer.png')],
      context,
    )
    expect(remote.files).toEqual({})
    expect(remote.diagnostics[0]?.message).toContain('local relative path')
  })
})
