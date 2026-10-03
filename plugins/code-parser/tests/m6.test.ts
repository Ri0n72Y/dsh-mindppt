import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, { serviceName } from '../src/index.ts'

const M6_TWO_COLUMN = readFileSync(
  new URL('../../../examples/m6-two-column.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

const M6_LAYOUTS = readFileSync(
  new URL('../../../examples/m6-layout-presets.mindppt', import.meta.url),
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
        const first = child.mindpptParser.compile(M6_TWO_COLUMN)
        const second = child.mindpptParser.compile(M6_TWO_COLUMN)
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

        expect(
          M6_TWO_COLUMN.slice(image.sourceRange.start, image.sourceRange.end),
        ).toBe('    ![Customer workshop](./assets/customer.svg)')
      },
    })
  })

  it('lays out hero, title-content, and two-column as distinct stable presets', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m6-layout-presets-test',
      inject: [serviceName],
      apply(child: Context) {
        const first = child.mindpptParser.compile(M6_LAYOUTS)
        const second = child.mindpptParser.compile(M6_LAYOUTS)
        expect(second).toEqual(first)

        const hero = first.slides.find((slide) => slide.id === 'hero')
        const agenda = first.slides.find((slide) => slide.id === 'agenda')
        const customer = first.slides.find((slide) => slide.id === 'customer')

        expect(hero?.layout).toBe('hero')
        expect(hero?.elements).toEqual([
          expect.objectContaining({
            id: 'slide:hero/title:0',
            kind: 'title',
            x: 160,
            y: 234,
            width: 960,
            height: 84,
          }),
          expect.objectContaining({
            id: 'slide:hero/subtitle:0',
            kind: 'subtitle',
            x: 160,
            y: 338,
            width: 960,
            height: 56,
          }),
          expect.objectContaining({
            id: 'slide:hero/text:0',
            kind: 'text',
            x: 160,
            y: 414,
            width: 960,
            height: 72,
          }),
        ])

        expect(agenda?.layout).toBe('title-content')
        expect(agenda?.elements).toEqual([
          expect.objectContaining({
            id: 'slide:agenda/title:0',
            kind: 'title',
            x: 96,
            y: 56,
            width: 1088,
            height: 84,
          }),
          expect.objectContaining({
            id: 'slide:agenda/text:0',
            kind: 'text',
            x: 128,
            y: 184,
            width: 1024,
            height: 72,
          }),
          expect.objectContaining({
            id: 'slide:agenda/list:0',
            kind: 'list',
            x: 128,
            y: 276,
            width: 1024,
            height: 100,
          }),
        ])

        expect(customer).toEqual(expect.objectContaining({
          layout: 'two-column',
          width: 1280,
          height: 720,
        }))
        expect(customer?.elements.map((element) => element.id)).toEqual([
          'slide:customer/title:0',
          'slide:customer/left/text:0',
          'slide:customer/left/list:0',
          'slide:customer/right/image:0',
        ])
      },
    })
  })
})
