import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService from '../src/index.ts'

const input = `mindppt
slide signed {
  layout two-column
  # Signed
  right {
    chart bar {
      labels ["Positive annual results", "Zero", "Negative results"]
      values [18, 0, -12]
    }
  }
}
`

describe('P3 signed bar scene lowering', () => {
  it('preserves all IDs, neutral style and a one-pixel zero marker', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)
    await ctx.plugin({
      name: 'p3-canvas-signed',
      inject: ['mindpptParser', 'mindpptCanvas'],
      apply(c: Context) {
        const first = c.mindpptParser.compile(input)
        const scene = c.mindpptCanvas.scene
        const chart = first.slides[0]!.elements.find(e => e.kind === 'bar-chart')!
        if (chart.kind !== 'bar-chart') throw Error()
        const prefix = 'slide:signed/right/bar-chart:0'
        const find = (id: string) => scene.find(el => el.id === id)
        expect(find(prefix + '/baseline')).toMatchObject({
          type: 'line', y: chart.baselineY, strokeColor: '#64748b',
        })
        expect(find(prefix + '/bar:1/box')).toMatchObject({
          type: 'rectangle', height: 1, y: chart.baselineY,
          backgroundColor: '#6366f1',
        })
        expect(find(prefix + '/bar:2/box')).toMatchObject({
          y: chart.baselineY, height: chart.bars[2]!.height,
        })
        expect(find(prefix + '/bar:2/value')).toMatchObject({
          y: chart.bars[2]!.valueLabelY,
          label: { text: '-12', fontSize: 15, strokeColor: '#334155' },
        })
        expect(find(prefix + '/bar:1/value')).toMatchObject({
          label: { text: '0' },
        })
        expect(find(prefix + '/bar:0/label')).toMatchObject({
          width: chart.bars[0]!.labelWidth,
          height: 40,
          label: { text: 'Positive annual results', fontSize: 16 },
        })
        c.mindpptParser.compile(input)
        expect(c.mindpptCanvas.scene).toEqual(scene)
      },
    })
    await ctx.fiber.dispose()
  })
  it.each([
    ['underflow to zero', '1e-308'],
    ['nonzero subpixel', '1'],
  ])('keeps %s positive bar above baseline in a mixed extreme domain', async (
    _description, positive,
  ) => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)
    const source = `mindppt
slide extremes {
  layout two-column
  # Extremes
  right {
    chart bar {
      labels ["Tiny positive", "Zero", "Negative"]
      values [${positive}, 0, -1e308]
    }
  }
}
`
    try {
      await ctx.plugin({
        name: 'p3-canvas-subpixel-' + positive,
        inject: ['mindpptParser', 'mindpptCanvas'],
        apply(c: Context) {
          const structure = c.mindpptParser.compile(source)
          const slide = structure.slides[0]!
          const chart = slide.elements.find(e => e.kind === 'bar-chart')!
          if (chart.kind !== 'bar-chart') throw Error('Missing chart')
          const [tiny, zero, negative] = chart.bars
          const baseline = slide.y + chart.baselineY
          const prefix = 'slide:extremes/right/bar-chart:0'
          const scene = c.mindpptCanvas.scene
          const find = (id: string) => scene.find(e => e.id === id)

          // Compiler-owned semantic geometry remains unchanged, even on underflow.
          expect(tiny!.value).toBeGreaterThan(0)
          expect(tiny!.height).toBeGreaterThanOrEqual(0)
          expect(tiny!.height).toBeLessThan(1)
          expect(tiny!.y).toBe(chart.baselineY)
          expect(zero).toMatchObject({ value: 0, height: 0, y: chart.baselineY })
          expect(negative!.value).toBeLessThan(0)
          expect(negative!.y).toBe(chart.baselineY)
          expect(source.slice(tiny!.valueSourceRange.start, tiny!.valueSourceRange.end))
            .toContain('values [')
          expect(c.mindpptParser.diagnostics).toEqual([])

          // Only the Canvas skeleton uses the sign-aware minimum-visible marker.
          const tinyBox = find(prefix + '/bar:0/box')!
          const zeroBox = find(prefix + '/bar:1/box')!
          const negativeBox = find(prefix + '/bar:2/box')!
          expect(tinyBox).toMatchObject({
            type: 'rectangle', y: baseline - 1, height: 1,
            backgroundColor: '#6366f1', strokeColor: '#4f46e5',
          })
          expect(tinyBox.y! + tinyBox.height!).toBeLessThanOrEqual(baseline)
          expect(zeroBox).toMatchObject({ y: baseline, height: 1 })
          expect(negativeBox).toMatchObject({
            y: baseline, height: negative!.height,
          })
          expect(negativeBox.y).toBeGreaterThanOrEqual(baseline)

          c.mindpptParser.compile(source)
          expect(c.mindpptCanvas.scene).toEqual(scene)
        },
      })
    } finally {
      await ctx.fiber.dispose()
    }
  })

})
