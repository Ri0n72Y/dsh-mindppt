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
})
