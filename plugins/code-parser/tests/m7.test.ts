import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from '../src/index.ts'

const M7 = readFileSync(
  new URL('../../../examples/m7-data-analysis.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('M7.1 structured table and bar chart', () => {
  it('compiles stable structured semantics and two-column geometry', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m7-parser-test',
      inject: ['mindpptParser'],
      apply(child: Context) {
        const first = child.mindpptParser.compile(M7)
        const second = child.mindpptParser.compile(M7)
        expect(second).toEqual(first)

        const slide = first.slides.find((entry) => entry.id === 'analysis')
        const table = slide?.elements.find((entry) => entry.kind === 'table')
        const chart = slide?.elements.find((entry) => entry.kind === 'bar-chart')

        expect(slide?.layout).toBe('two-column')
        expect(table).toEqual(expect.objectContaining({
          id: 'slide:analysis/left/table:0',
          kind: 'table',
          slot: 'left',
          x: 96,
          width: 520,
        }))
        expect(chart).toEqual(expect.objectContaining({
          id: 'slide:analysis/right/bar-chart:0',
          kind: 'bar-chart',
          slot: 'right',
          x: 664,
          width: 520,
        }))

        if (table?.kind !== 'table' || chart?.kind !== 'bar-chart') return
        expect(table.header.map((cell) => cell.value)).toEqual([
          'Channel', 'Orders', 'Revenue',
        ])
        expect(table.rows.map((row) => row.map((cell) => cell.value))).toEqual([
          ['Direct', 184, 42600],
          ['Partner', 121, 31900],
          ['Marketplace', 96, 24700],
        ])
        expect(table.header.map((cell) => cell.id)).toEqual([
          'slide:analysis/left/table:0/header:0',
          'slide:analysis/left/table:0/header:1',
          'slide:analysis/left/table:0/header:2',
        ])
        expect(chart.bars.map((bar) => [bar.id, bar.label, bar.value])).toEqual([
          ['slide:analysis/right/bar-chart:0/bar:0', 'Direct', 184],
          ['slide:analysis/right/bar-chart:0/bar:1', 'Partner', 121],
          ['slide:analysis/right/bar-chart:0/bar:2', 'Marketplace', 96],
        ])
        expect(chart.bars[0]!.height).toBeGreaterThan(chart.bars[1]!.height)
        expect(chart.bars[1]!.height).toBeGreaterThan(chart.bars[2]!.height)
        expect(M7.slice(table.sourceRange.start, table.sourceRange.end))
          .toContain('table {')
        expect(M7.slice(chart.sourceRange.start, chart.sourceRange.end))
          .toContain('chart bar {')
      },
    })
  })

  it('anchors structured diagnostics to the offending source', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m7-diagnostics-test',
      inject: ['mindpptParser'],
      apply(child: Context) {
        const cases = [
          {
            source: M7.replace(
              'header ["Channel", "Orders", "Revenue"]',
              'header []',
            ),
            message: 'table header must contain at least one cell',
            slice: '      header []',
          },
          {
            source: M7.replace(
              'row ["Partner", 121, 31900]',
              'row []',
            ),
            message: 'table row width must match header column count',
            slice: '      row []',
          },
          {
            source: M7.replace(
              'labels ["Direct", "Partner", "Marketplace"]',
              'labels []',
            ),
            message: 'chart bar requires at least one category',
            slice: '      labels []',
          },
          {
            source: M7.replace(
              'row ["Partner", 121, 31900]',
              'row ["Partner", 121]',
            ),
            message: 'table row width must match header column count',
            slice: '      row ["Partner", 121]',
          },
          {
            source: M7.replace(
              'values [184, 121, 96]',
              'values [184, "bad", 96]',
            ),
            message: 'chart values must be finite numbers',
            slice: '      values [184, "bad", 96]',
          },
          {
            source: M7.replace(
              'values [184, 121, 96]',
              'values [184, 121]',
            ),
            message: 'chart category/value count mismatch',
            slice: '      values [184, 121]',
          },
        ]

        for (const item of cases) {
          expect(() => child.mindpptParser.compile(item.source)).toThrow(item.message)
          const diagnostic = child.mindpptParser.diagnostics[0]
          expect(diagnostic?.sourceRange).toBeDefined()
          expect(item.source.slice(
            diagnostic!.sourceRange!.start,
            diagnostic!.sourceRange!.end,
          )).toBe(item.slice)
        }
      },
    })
  })

  it('locates unclosed structured blocks', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m7-unclosed-test',
      inject: ['mindpptParser'],
      apply(child: Context) {
        for (const [source, message] of [
          [
            'mindppt\n\nslide broken {\n  table {\n    header ["A"]\n',
            'Unclosed table block',
          ],
          [
            'mindppt\n\nslide broken {\n  chart bar {\n    labels ["A"]\n',
            'Unclosed chart bar block',
          ],
        ] as const) {
          expect(() => child.mindpptParser.compile(source)).toThrow(message)
          const diagnostic = child.mindpptParser.diagnostics[0]
          expect(diagnostic?.sourceRange).toBeDefined()
          expect(source.slice(diagnostic!.sourceRange!.start)).toContain('{')
        }
      },
    })
  })
})
