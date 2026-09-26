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
  it('renders parser output through the Cordis event path', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    let renderedTypes: string[] = []
    let renderedText = ''

    await ctx.plugin({
      name: 'mindppt-render-test-driver',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        child.mindpptParser.compile(HELLO)
        renderedTypes = child.mindpptCanvas.elements.map((element) => element.type)
        const text = child.mindpptCanvas.elements.find((element) => element.type === 'text')
        renderedText = text?.type === 'text' ? text.text : ''
      },
    })

    expect(renderedTypes).toEqual(['text', 'frame'])
    expect(renderedText).toBe('Hello World')
  })
})
