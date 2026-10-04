import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService from '../src/index.ts'

const M7 = readFileSync(
  new URL('../../../examples/m7-data-analysis.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('M7.1 Excalidraw lowering', () => {
  it('mechanically lowers table cells and single-series bars stably', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    await ctx.plugin({
      name: 'mindppt-m7-render-test',
      inject: ['mindpptParser', 'mindpptCanvas'],
      apply(child: Context) {
        child.mindpptParser.compile(M7)
        const first = child.mindpptCanvas.scene
        child.mindpptParser.compile(M7)
        const second = child.mindpptCanvas.scene
        expect(second).toEqual(first)

        expect(first.find((element) =>
          element.id === 'slide:analysis/left/table:0/header:0/box'
        )).toEqual(expect.objectContaining({
          type: 'rectangle',
          backgroundColor: '#eef2ff',
          label: expect.objectContaining({ text: 'Channel' }),
        }))

        const bars = first.filter((element) =>
          element.type === 'rectangle'
          && element.id?.startsWith('slide:analysis/right/bar-chart:0/bar:')
          && element.id.endsWith('/box')
        )
        expect(bars).toHaveLength(3)
        expect(bars.map((bar) => bar.id)).toEqual([
          'slide:analysis/right/bar-chart:0/bar:0/box',
          'slide:analysis/right/bar-chart:0/bar:1/box',
          'slide:analysis/right/bar-chart:0/bar:2/box',
        ])
        expect(bars[0]?.height ?? 0).toBeGreaterThan(bars[1]?.height ?? 0)
        expect(bars[1]?.height ?? 0).toBeGreaterThan(bars[2]?.height ?? 0)
        expect(first.find((element) =>
          element.id === 'slide:analysis/right/bar-chart:0/baseline'
        )?.type).toBe('line')
      },
    })
  })
})
