import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService, { serviceName } from '../src/index.ts'

const M6 = readFileSync(
  new URL('../../../examples/m6-two-column.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

const COLLISION = `mindppt

slide collision {
  layout two-column

  left {
    ![First](./assets/72p9kvztbry2.png)
  }

  right {
    ![Second](./assets/9035ngs4mk8m.png)
  }
}
`

describe('M6 Excalidraw image lowering', () => {
  it('keeps semantic image identity stable before binary resolution', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    await ctx.plugin({
      name: 'mindppt-m6-render-test',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        child.mindpptParser.compile(M6)
        const firstImage = child.mindpptCanvas.scene.find(
          (element) => element.type === 'image',
        )
        const firstRequest = child.mindpptCanvas.assetRequests[0]

        child.mindpptParser.compile(M6)
        const secondImage = child.mindpptCanvas.scene.find(
          (element) => element.type === 'image',
        )
        const secondRequest = child.mindpptCanvas.assetRequests[0]

        expect(firstImage).toEqual(expect.objectContaining({
          type: 'image',
          id: 'slide:customer/right/image:0',
          x: 664,
          y: 176,
          width: 520,
          height: 390,
          status: 'saved',
          scale: [1, 1],
        }))
        expect(firstImage?.type).toBe('image')
        expect(secondImage?.type).toBe('image')
        if (firstImage?.type !== 'image' || secondImage?.type !== 'image') {
          return
        }

        expect(secondImage.id).toBe(firstImage.id)
        expect(secondImage.fileId).toBe(firstImage.fileId)
        expect(firstRequest).toEqual(expect.objectContaining({
          elementIds: ['slide:customer/right/image:0'],
          source: './assets/customer.svg',
          sourceRange: expect.any(Object),
        }))
        expect(secondRequest).toEqual(firstRequest)
      },
    })
  })

  it('deduplicates by exact source rather than a short fileId hash', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    await ctx.plugin({
      name: 'mindppt-m6-collision-test',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        child.mindpptParser.compile(COLLISION)

        expect(child.mindpptCanvas.assetRequests).toEqual([
          expect.objectContaining({
            source: './assets/72p9kvztbry2.png',
            elementIds: ['slide:collision/left/image:0'],
          }),
          expect.objectContaining({
            source: './assets/9035ngs4mk8m.png',
            elementIds: ['slide:collision/right/image:0'],
          }),
        ])

        const images = child.mindpptCanvas.scene.filter(
          (element) => element.type === 'image',
        )
        expect(images).toHaveLength(2)
        expect(images[0]?.id).not.toBe(images[1]?.id)
        expect(images[0]?.type).toBe('image')
        expect(images[1]?.type).toBe('image')
        if (images[0]?.type !== 'image' || images[1]?.type !== 'image') return
        expect(images[0].fileId).not.toBe(images[1].fileId)
      },
    })
  })
})
