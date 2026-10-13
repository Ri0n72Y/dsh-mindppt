import { readFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService from '../src/index.ts'

const SOURCE = readFileSync(
  new URL('../../../examples/layout-p0-p1-qa.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('P2 neutral rendering on the existing P0/P1 corpus', () => {
  it('keeps P1 diagnostics and semantic positions while styling each existing preset', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    try {
      await ctx.plugin({
        name: 'mindppt-p2-visual-test',
        inject: ['mindpptParser', 'mindpptCanvas'],
        apply(child: Context) {
          const structure = child.mindpptParser.compile(SOURCE)
          const warnings = child.mindpptParser.diagnostics
          const scene = child.mindpptCanvas.scene
          const byId = (id: string) => scene.find(element => element.id === id)

          expect(warnings.map(diagnostic => diagnostic.severity)).toEqual([
            'warning', 'warning', 'warning',
          ])
          expect(warnings[0]?.sourceRange).toEqual(
            structure.slides[1]?.elements.at(-1)?.sourceRange,
          )
          expect(structure.slides.find(slide => slide.id === 'hero-fit')
            ?.elements[0]).toMatchObject({
            id: 'slide:hero-fit/title:0',
            x: 160, y: 234, width: 960, height: 84,
          })
          expect(byId('slide:hero-fit/title:0/box')).toMatchObject({
            label: {
              text: 'Focused message',
              fontSize: 48,
              textAlign: 'center',
              verticalAlign: 'middle',
              strokeColor: '#0f172a',
            },
          })
          expect(byId('slide:hero-fit/subtitle:0/box')).toMatchObject({
            label: { textAlign: 'center', strokeColor: '#475569' },
          })
          expect(byId('slide:cjk-long/title:0/box')).toMatchObject({
            label: { textAlign: 'left', strokeColor: '#0f172a' },
          })
          expect(byId('slide:image-ratios/title:0/box')).toMatchObject({
            label: { textAlign: 'left', strokeColor: '#0f172a' },
          })
          expect(byId('slide:hero-fit/surface')).toMatchObject({
            backgroundColor: '#ffffff', strokeColor: '#cbd5e1',
          })
          expect(byId('slide:dense-data/left/table:0/header:0/box'))
            .toMatchObject({
              backgroundColor: '#f1f5f9', strokeColor: '#cbd5e1',
              label: { fontSize: 17, strokeColor: '#0f172a' },
            })
          expect(byId('slide:dense-data/left/table:0/row:0/cell:0/box'))
            .toMatchObject({
              backgroundColor: '#ffffff',
              label: { fontSize: 17, strokeColor: '#334155' },
            })
          expect(byId('slide:dense-data/right/bar-chart:0/bar:0/box'))
            .toMatchObject({ backgroundColor: '#6366f1' })
          expect(byId('slide:dense-data/right/bar-chart:0/bar:0/label'))
            .toMatchObject({
              label: { fontSize: 16, strokeColor: '#475569' },
            })
          expect(byId('slide:extensions/extension:1/box')).toMatchObject({
            backgroundColor: '#f8fafc', strokeColor: '#cbd5e1',
            label: { fontSize: 22, strokeColor: '#334155' },
          })

          const first = scene
          child.mindpptParser.compile(SOURCE)
          expect(child.mindpptCanvas.scene).toEqual(first)
        },
      })
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
