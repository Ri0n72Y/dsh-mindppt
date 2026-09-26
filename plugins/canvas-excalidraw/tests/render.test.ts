import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService, { serviceName } from '../src/index.ts'

const HELLO = `mindppt

slide hello {
  title "Hello World"
}
`

describe('MindPptCanvasService', () => {
  it('renders parser output as a slide surface with centered title', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    let renderedTypes: string[] = []
    let renderedText = ''
    let surface: Record<string, unknown> | undefined
    let shadow: Record<string, unknown> | undefined

    await ctx.plugin({
      name: 'mindppt-render-test-driver',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        child.mindpptParser.compile(HELLO)

        renderedTypes = child.mindpptCanvas.scene.map((element) => element.type)

        const text = child.mindpptCanvas.scene.find((element) => element.type === 'text')
        renderedText = text?.type === 'text' ? text.text : ''

        surface = child.mindpptCanvas.scene.find(
          (element) => element.id === 'slide:hello/surface',
        ) as Record<string, unknown> | undefined

        shadow = child.mindpptCanvas.scene.find(
          (element) => element.id === 'slide:hello/shadow',
        ) as Record<string, unknown> | undefined
      },
    })

    expect(renderedTypes).toEqual(['rectangle', 'rectangle', 'text', 'frame'])
    expect(renderedText).toBe('Hello World')

    expect(surface).toEqual(expect.objectContaining({
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
      backgroundColor: '#ffffff',
    }))

    expect(shadow).toEqual(expect.objectContaining({
      x: 18,
      y: 18,
      width: 1600,
      height: 900,
      opacity: 14,
    }))
  })
})
