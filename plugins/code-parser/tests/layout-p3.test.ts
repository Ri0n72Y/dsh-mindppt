import { readFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import MindPptParserService from '../src/index.ts'

const CORPUS = readFileSync(
  new URL('../../../examples/layout-p0-p1-qa.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

const signed = `mindppt
slide signed {
  layout two-column
  # Values
  right {
    chart bar {
      labels ["Revenue growth", "No sales", "Losses"]
      values [18, 0, -12]
    }
  }
}
`

const dense = `mindppt
// 🧭 Before diagnostic source ranges.
slide dense {
  layout two-column
  # Data
  left {
    table {
      header ["Segment", "Revenue"]
${Array.from({ length: 15 }, (_, i) => `      row ["Segment ${i}", ${i}]`).join('\n')}
    }
  }
  right {
    chart bar {
      labels ["SupercalifragilisticCategory", "这是一个非常非常长的分类标签"]
      values [-7, 5]
    }
  }
}
`

describe('P3 bounded data layout and diagnostics', () => {
  it('retains P0/P1 corpus and all three existing overflow warnings', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin({
      name: 'p3-existing-corpus',
      inject: ['mindpptParser'],
      apply(c: Context) {
        const first = c.mindpptParser.compile(CORPUS)
        expect(c.mindpptParser.diagnostics.map(d => d.message)).toEqual([
          expect.stringContaining('hero-overflow'),
          expect.stringContaining('title-overflow'),
          expect.stringContaining('slot-overflow'),
        ])
        const denseSlide = first.slides.find(s => s.id === 'dense-data')!
        const table = denseSlide.elements.find(e => e.kind === 'table')!
        expect(table.id).toBe('slide:dense-data/left/table:0')
        expect(table.height).toBe(390)
      },
    })
    await ctx.fiber.dispose()
  })

  it('preserves all dense data and reports bounded warnings with UTF-16 source spans', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin({
      name: 'p3-overdense',
      inject: ['mindpptParser'],
      apply(c: Context) {
        const structure = c.mindpptParser.compile(dense)
        const slide = structure.slides[0]!
        const table = slide.elements.find(e => e.kind === 'table')!
        const chart = slide.elements.find(e => e.kind === 'bar-chart')!
        if (table.kind !== 'table' || chart.kind !== 'bar-chart') throw Error()
        expect(table.rows).toHaveLength(15)
        expect(table.rows[14]![0]?.value).toBe('Segment 14')
        expect(table.rows[14]![0]?.id).toBe('slide:dense/left/table:0/row:14/cell:0')
        expect(table.header[0]?.height).toBeCloseTo(390 / 16)
        expect(chart.bars.map(b => b.label)).toEqual([
          'SupercalifragilisticCategory', '这是一个非常非常长的分类标签',
        ])
        const diagnostics = c.mindpptParser.diagnostics
        expect(diagnostics).toHaveLength(3)
        expect(diagnostics.every(d => d.severity === 'warning')).toBe(true)
        expect(diagnostics[0]?.message).toContain('minimum 26px row')
        expect(diagnostics[0]?.sourceRange).toEqual(table.sourceRange)
        expect(diagnostics.slice(1).every(d => d.message.includes('two-line label'))).toBe(true)
        expect(diagnostics.slice(1).every(d =>
          dense.slice(d.sourceRange!.start, d.sourceRange!.end).trim()
            .startsWith('labels ['),
        )).toBe(true)
        expect(diagnostics[0]!.sourceRange!.start).toBeGreaterThan(dense.indexOf('🧭'))
        expect(c.mindpptParser.structure).toEqual(structure)
      },
    })
    await ctx.fiber.dispose()
  })

  it('places negative and positive end labels outside their bars, and zero at baseline', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin({
      name: 'p3-signed',
      inject: ['mindpptParser'],
      apply(c: Context) {
        const structure = c.mindpptParser.compile(signed)
        const chart = structure.slides[0]!.elements.find(e => e.kind === 'bar-chart')!
        if (chart.kind !== 'bar-chart') throw Error()
        expect(c.mindpptParser.diagnostics).toEqual([])
        const [plus, zero, minus] = chart.bars
        expect(plus!.value).toBe(18)
        expect(zero!.value).toBe(0)
        expect(minus!.value).toBe(-12)
        expect(plus!.y + plus!.height).toBeCloseTo(chart.baselineY)
        expect(minus!.y).toBeCloseTo(chart.baselineY)
        expect(zero!.y).toBeCloseTo(chart.baselineY)
        expect(zero!.height).toBe(0)
        expect(plus!.valueLabelY + plus!.valueLabelHeight).toBeLessThanOrEqual(plus!.y)
        expect(minus!.valueLabelY).toBeGreaterThanOrEqual(minus!.y + minus!.height)
        expect(minus!.valueLabelY + minus!.valueLabelHeight)
          .toBeLessThanOrEqual(chart.plotY + chart.plotHeight)
        expect(chart.bars.map(b => signed.slice(
          b.valueSourceRange.start, b.valueSourceRange.end,
        ).trim())).toEqual(Array(3).fill('values [18, 0, -12]'))
      },
    })
    await ctx.fiber.dispose()
  })
})
