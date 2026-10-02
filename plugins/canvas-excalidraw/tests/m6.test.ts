import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService, { serviceName } from '../src/index.ts'

const M6 = readFileSync(
  new URL('../../../examples/m6-two-column.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('M6 Excalidraw image lowering', () => {
  it('renders deterministic image geometry and stable asset requests', async () => {
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

        expect(firstImage.fileId).toBe(firstRequest?.fileId)
        expect(secondImage.fileId).toBe(firstImage.fileId)
        expect(secondRequest?.fileId).toBe(firstRequest?.fileId)
        expect(firstRequest).toEqual(expect.objectContaining({
          source: './assets/customer.svg',
          sourceRange: expect.any(Object),
        }))
      },
    })
  })
})
