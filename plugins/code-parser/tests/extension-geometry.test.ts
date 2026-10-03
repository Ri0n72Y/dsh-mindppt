import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, {
  MindPptCompileError,
  serviceName,
} from '../src/index.ts'

describe('M6 extension geometry', () => {
  it('bounds a long single-line fallback by the two-column slot', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m6-extension-geometry-test',
      inject: [serviceName],
      apply(child: Context) {
        const fits = 'W'.repeat(368)
        const overflows = fits + 'W'
        const slide = child.mindpptParser.compile(extensionSource(fits)).slides[0]

        expect(slide?.elements.find((element) => element.kind === 'extension'))
          .toEqual(expect.objectContaining({
            x: 96,
            y: 176,
            width: 520,
            height: 478,
            slot: 'left',
          }))

        const invalidSource = extensionSource(overflows)
        try {
          child.mindpptParser.compile(invalidSource)
          throw new Error('Expected semantic overflow')
        } catch (error) {
          expect(error).toBeInstanceOf(MindPptCompileError)
          if (!(error instanceof MindPptCompileError)) return

          expect(error.message).toBe(
            'Content does not fit in the available semantic layout region',
          )
          expect(error.sourceRange).toBeDefined()
          if (!error.sourceRange) return
          expect(
            invalidSource.slice(error.sourceRange.start, error.sourceRange.end),
          ).toContain(overflows)
        }
      },
    })
  })
})

function extensionSource(body: string): string {
  return [
    'mindppt',
    '',
    'slide fit {',
    '  layout two-column',
    '',
    '  # Extension boundary',
    '',
    '  left {',
    '    ```demo',
    body,
    '    ```',
    '  }',
    '}',
    '',
  ].join('\n')
}
