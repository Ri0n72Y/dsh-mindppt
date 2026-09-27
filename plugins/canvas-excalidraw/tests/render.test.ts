import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService, { serviceName } from '../src/index.ts'

const M1 = `mindppt

tree LR {
  intro --> market
}

slide intro {
  # Introduction
}

slide market {
  # Market
}
`

describe('MindPptCanvasService', () => {
  it('renders two slide frames connected by one tree arrow', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    let scene: MindPptCanvasService['scene'] = []

    await ctx.plugin({
      name: 'mindppt-render-test-driver',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        child.mindpptParser.compile(M1)
        scene = child.mindpptCanvas.scene
      },
    })

    expect(scene.map((element) => element.type)).toEqual([
      'arrow',
      'rectangle',
      'rectangle',
      'frame',
      'rectangle',
      'rectangle',
      'frame',
    ])

    const arrow = scene.find((element) => element.type === 'arrow')
    expect(arrow).toEqual(expect.objectContaining({
      id: 'tree:intro->market',
      x: 1280,
      y: 360,
      endArrowhead: 'arrow',
    }))
    expect((arrow as { points?: unknown }).points).toEqual([
      [0, 0],
      [600, 0],
    ])

    const titles = scene.flatMap((element) =>
      element.type === 'rectangle' && 'label' in element && element.label?.text
        ? [element.label.text]
        : [],
    )

    expect(titles).toEqual(['Introduction', 'Market'])
  })
})
