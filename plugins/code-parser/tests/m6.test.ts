import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, { serviceName } from '../src/index.ts'

const M6 = readFileSync(
  new URL('../../../examples/m6-two-column.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('M6 parser and semantic layout', () => {
  it('compiles two-column slots and Markdown image content deterministically', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m6-parser-test',
      inject: [serviceName],
      apply(child: Context) {
        const first = child.mindpptParser.compile(M6)
        const second = child.mindpptParser.compile(M6)
        const slide = first.slides[0]

        expect(slide).toEqual(expect.objectContaining({
          id: 'customer',
          layout: 'two-column',
          width: 1280,
          height: 720,
        }))
        expect(second).toEqual(first)

        expect(slide?.elements).toEqual([
          expect.objectContaining({
            id: 'slide:customer/title:0',
            kind: 'title',
            x: 96,
            y: 56,
            width: 1088,
            height: 84,
          }),
          expect.objectContaining({
            id: 'slide:customer/left/text:0',
            kind: 'text',
            slot: 'left',
            x: 96,
            y: 176,
            width: 520,
            height: 72,
          }),
          expect.objectContaining({
            id: 'slide:customer/left/list:0',
            kind: 'list',
            slot: 'left',
            x: 96,
            y: 268,
            width: 520,
            height: 100,
          }),
          expect.objectContaining({
            id: 'slide:customer/right/image:0',
            kind: 'image',
            slot: 'right',
            alt: 'Customer workshop',
            src: './assets/customer.svg',
            x: 664,
            y: 176,
            width: 520,
            height: 390,
          }),
        ])

        const image = slide?.elements.at(-1)
        expect(image?.kind).toBe('image')
        if (image?.kind !== 'image') return

        expect(M6.slice(image.sourceRange.start, image.sourceRange.end)).toBe(
          '    ![Customer workshop](./assets/customer.svg)',
        )
      },
    })
  })
})
