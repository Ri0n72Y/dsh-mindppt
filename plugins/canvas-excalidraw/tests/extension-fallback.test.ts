import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService, { serviceName } from '../src/index.ts'

const SOURCE = [
  'mindppt',
  '',
  'slide fit {',
  '  layout two-column',
  '',
  '  # Extension fallback',
  '',
  '  left {',
  '    ```demo',
  'W'.repeat(200),
  '    ```',
  '  }',
  '}',
  '',
].join('\n')

describe('M6 extension fallback lowering', () => {
  it('binds fallback text to the compiler-owned semantic box', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    await ctx.plugin({
      name: 'mindppt-m6-extension-render-test',
      inject: ['mindpptParser', serviceName],
      apply(child: Context) {
        child.mindpptParser.compile(SOURCE)

        const id = 'slide:fit/left/extension:0'
        const box = child.mindpptCanvas.scene.find(
          (element) => element.id === id + '/box',
        )

        expect(box).toEqual(expect.objectContaining({
          type: 'rectangle',
          x: 96,
          y: 176,
          width: 520,
          height: 285,
          strokeStyle: 'dashed',
          label: expect.objectContaining({
            text: '[demo]\n' + 'W'.repeat(200),
            fontSize: 22,
            textAlign: 'left',
            verticalAlign: 'top',
          }),
        }))
        expect(
          child.mindpptCanvas.scene.some(
            (element) => element.id === id + '/text',
          ),
        ).toBe(false)
      },
    })
  })
})
