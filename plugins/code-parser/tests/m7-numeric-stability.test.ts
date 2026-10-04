import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from '../src/index.ts'

const M7 = readFileSync(
  new URL('../../../examples/m7-data-analysis.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

const CASES = [
  {
    name: 'positive',
    labels: 'labels ["A", "B", "C"]',
    values: 'values [3, 2, 1]',
  },
  {
    name: 'mixed',
    labels: 'labels ["A", "B", "C"]',
    values: 'values [-3, 0, 2]',
  },
  {
    name: 'zero',
    labels: 'labels ["A", "B", "C"]',
    values: 'values [0, 0, 0]',
  },
  {
    name: 'decimal',
    labels: 'labels ["A", "B", "C"]',
    values: 'values [0.5, 1.25, 0.125]',
  },
  {
    name: 'large',
    labels: 'labels ["A", "B", "C"]',
    values: 'values [1e308, 5e307, 1e307]',
  },
  {
    name: 'opposite-sign extreme',
    labels: 'labels ["A", "B"]',
    values: 'values [-1e308, 1e308]',
  },
]

describe('M7.1 bar chart numeric stability', () => {
  it('keeps accepted finite values finite and deterministic', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m7-numeric-stability-test',
      inject: ['mindpptParser'],
      apply(child: Context) {
        for (const item of CASES) {
          const source = M7
            .replace(
              'labels ["Direct", "Partner", "Marketplace"]',
              item.labels,
            )
            .replace('values [184, 121, 96]', item.values)

          const first = child.mindpptParser.compile(source)
          expect(child.mindpptParser.compile(source)).toEqual(first)

          const slide = first.slides.find((entry) => entry.id === 'analysis')
          const chart = slide?.elements.find((entry) => entry.kind === 'bar-chart')
          if (!chart || chart.kind !== 'bar-chart') {
            throw new Error('bar chart missing for ' + item.name)
          }

          for (const geometry of [
            chart.plotX,
            chart.plotY,
            chart.plotWidth,
            chart.plotHeight,
            chart.baselineY,
          ]) {
            expect(Number.isFinite(geometry)).toBe(true)
          }

          for (const bar of chart.bars) {
            for (const geometry of [
              bar.x,
              bar.y,
              bar.width,
              bar.height,
              bar.labelX,
              bar.labelY,
              bar.labelWidth,
              bar.labelHeight,
              bar.valueLabelX,
              bar.valueLabelY,
              bar.valueLabelWidth,
              bar.valueLabelHeight,
            ]) {
              expect(Number.isFinite(geometry)).toBe(true)
            }
            expect(bar.width).toBeGreaterThanOrEqual(0)
            expect(bar.height).toBeGreaterThanOrEqual(0)
          }

          if (item.name === 'mixed') {
            const zero = chart.bars.find((bar) => bar.value === 0)
            const negative = chart.bars.find((bar) => bar.value < 0)
            const positive = chart.bars.find((bar) => bar.value > 0)
            expect(zero?.height).toBe(0)
            expect(zero?.y).toBe(chart.baselineY)
            expect(negative?.y).toBe(chart.baselineY)
            expect(positive?.y).toBeLessThan(chart.baselineY)
          }

          if (item.name === 'zero') {
            expect(chart.bars.every((bar) => bar.height === 0)).toBe(true)
            expect(chart.bars.every((bar) => bar.y === chart.baselineY)).toBe(true)
          }

          if (item.name === 'opposite-sign extreme') {
            expect(chart.bars).toHaveLength(2)
            expect(chart.bars.every((bar) => bar.height > 0)).toBe(true)
            expect(chart.bars[0]!.y).toBe(chart.baselineY)
            expect(chart.bars[1]!.y).toBeLessThan(chart.baselineY)
          }
        }
      },
    })
  })
})
