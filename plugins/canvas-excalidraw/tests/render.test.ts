import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService, { serviceName } from '../src/index.ts'

const M2 = readFileSync(
  new URL('../../../examples/m2-content-profile.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('MindPptCanvasService', () => {
  it('renders M2 Markdown content and unknown extension fallback', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    let scene: MindPptCanvasService['scene'] = []

    await ctx.plugin({
      name: 'mindppt-render-test-driver',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        child.mindpptParser.compile(M2)
        scene = child.mindpptCanvas.scene
      },
    })

    const arrow = scene.find((element) => element.type === 'arrow')
    expect(arrow).toEqual(expect.objectContaining({
      id: 'tree:overview->math',
      x: 1280,
      y: 360,
    }))

    const visibleText = scene.flatMap((element) => {
      if (element.type === 'text') return [element.text]
      if (element.type === 'rectangle' && 'label' in element && element.label?.text) {
        return [element.label.text]
      }
      return []
    })

    expect(visibleText).toEqual(expect.arrayContaining([
      'Outdoor Market',
      '2026 snapshot',
      'Demand remains seasonal.',
      '• Premium products gain share\n• Online channels continue growing',
      '1. Confirm positioning\n2. Compare substitutes',
      'A compact mathematical example.',
      'Need --> Product',
      '[latex]\n  e^{i\\pi} + 1 = 0',
    ]))

    expect(scene).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'text',
        id: 'slide:math/extension:0/text',
        text: '[latex]\n  e^{i\\pi} + 1 = 0',
      }),
    ]))
  })
})
