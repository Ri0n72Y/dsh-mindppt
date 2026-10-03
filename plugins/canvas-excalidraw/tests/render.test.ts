import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, {
  type SlideNode,
  type TreeDirection,
} from 'dsh-mindppt-code-parser'
import MindPptCanvasService, { serviceName } from '../src/index.ts'

const M2 = readFileSync(
  new URL('../../../examples/m2-content-profile.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

const M4 = readFileSync(
  new URL('../../../examples/m4-branching-lr-tree.mindppt', import.meta.url),
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
        type: 'rectangle',
        id: 'slide:math/extension:0/box',
        label: expect.objectContaining({
          text: '[latex]\n  e^{i\\pi} + 1 = 0',
          fontSize: 22,
        }),
      }),
    ]))
    expect(
      scene.some((element) => element.id === 'slide:math/extension:0/text'),
    ).toBe(false)
  })
  it('renders every M4 slide frame and primary tree arrow', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    let scene: MindPptCanvasService['scene'] = []

    await ctx.plugin({
      name: 'mindppt-m4-render-test-driver',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        child.mindpptParser.compile(M4)
        scene = child.mindpptCanvas.scene
      },
    })

    const frames = scene.filter((element) => element.type === 'frame')
    const arrows = scene.filter((element) => element.type === 'arrow')

    expect(frames).toHaveLength(6)
    expect(arrows).toHaveLength(5)
    expect(frames.map((frame) => frame.id)).toEqual(expect.arrayContaining([
      'slide:intro',
      'slide:market',
      'slide:problem',
      'slide:customer',
      'slide:competitor',
      'slide:solution',
    ]))
    expect(arrows.map((arrow) => arrow.id)).toEqual(expect.arrayContaining([
      'tree:intro->market',
      'tree:intro->problem',
      'tree:market->customer',
      'tree:market->competitor',
      'tree:problem->solution',
    ]))
  })
  it('anchors primary tree arrows to the correct slide edges in every direction', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    await ctx.plugin({
      name: 'mindppt-m4-direction-render-test-driver',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        for (const direction of ['LR', 'RL', 'TB', 'TD', 'BT'] as const) {
          const source = M4.replace('tree LR {', `tree ${direction} {`)
          const structure = child.mindpptParser.compile(source)
          const scene = child.mindpptCanvas.scene
          const arrow = scene.find(
            (element) =>
              element.type === 'arrow'
              && element.id === 'tree:intro->market',
          )
          const from = structure.slides.find((slide) => slide.id === 'intro')!
          const to = structure.slides.find((slide) => slide.id === 'market')!
          const [start, end] = expectedEndpoints(direction, from, to)

          expect(arrow).toEqual(expect.objectContaining({
            x: start.x,
            y: start.y,
            points: [
              [0, 0],
              [end.x - start.x, end.y - start.y],
            ],
          }))
        }
      },
    })
  })

})

function expectedEndpoints(
  direction: TreeDirection,
  source: SlideNode,
  target: SlideNode,
): [{ x: number; y: number }, { x: number; y: number }] {
  switch (direction) {
    case 'LR':
      return [
        { x: source.x + source.width, y: source.y + source.height / 2 },
        { x: target.x, y: target.y + target.height / 2 },
      ]
    case 'RL':
      return [
        { x: source.x, y: source.y + source.height / 2 },
        { x: target.x + target.width, y: target.y + target.height / 2 },
      ]
    case 'TB':
    case 'TD':
      return [
        { x: source.x + source.width / 2, y: source.y + source.height },
        { x: target.x + target.width / 2, y: target.y },
      ]
    case 'BT':
      return [
        { x: source.x + source.width / 2, y: source.y },
        { x: target.x + target.width / 2, y: target.y + target.height },
      ]
  }
}
