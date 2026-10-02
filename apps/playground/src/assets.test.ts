import { describe, expect, it } from 'vitest'

import type { CanvasAssetRequest } from 'dsh-mindppt-canvas-excalidraw'

import { resolveCanvasAssets } from './assets.ts'

function request(source: string): CanvasAssetRequest {
  return {
    fileId: 'asset-fixture' as CanvasAssetRequest['fileId'],
    source,
    sourceRange: { start: 10, end: 42 },
  }
}

describe('playground local asset resolution', () => {
  it('resolves image data relative to the MindPPT document path', () => {
    const result = resolveCanvasAssets(
      [request('./assets/customer.svg')],
      {
        documentPath: 'examples/m6-two-column.mindppt',
        files: {
          'examples/assets/customer.svg': {
            mimeType: 'image/svg+xml',
            dataURL: 'data:image/svg+xml,%3Csvg%2F%3E',
          },
        },
      },
    )

    expect(result.diagnostics).toEqual([])
    expect(Object.keys(result.files)).toEqual(['asset-fixture'])
    expect(Object.values(result.files)[0]).toEqual(expect.objectContaining({
      id: 'asset-fixture',
      mimeType: 'image/svg+xml',
      dataURL: 'data:image/svg+xml,%3Csvg%2F%3E',
      created: 0,
    }))
  })

  it('reports missing and non-local assets without throwing', () => {
    const context = {
      documentPath: 'examples/m6-two-column.mindppt',
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
