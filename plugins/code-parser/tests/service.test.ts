import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, {
  MindPptSyntaxError,
  serviceName,
} from '../src/index.ts'

const HELLO = `mindppt

slide hello {
  title "Hello World"
}
`

describe('MindPptParserService', () => {
  it('provides the service to injected consumers and removes it on disposal', async () => {
    const ctx = new Context()
    const provider = await ctx.plugin(MindPptParserService)

    let observed: MindPptParserService | undefined
    await ctx.plugin({
      name: 'mindppt-parser-test-consumer',
      inject: [serviceName],
      apply(child: Context) {
        observed = child.mindpptParser
      },
    })

    expect(observed instanceof MindPptParserService).toBe(true)

    await provider.dispose()

    expect(ctx.get(serviceName) === undefined).toBe(true)
  })

  it('compiles the hello-world template into one deterministic slide', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    let structure: unknown
    await ctx.plugin({
      name: 'mindppt-parser-compile-test',
      inject: [serviceName],
      apply(child: Context) {
        structure = child.mindpptParser.compile(HELLO)
      },
    })

    expect(structure).toEqual({
      version: 0,
      slides: [
        expect.objectContaining({
          id: 'hello',
          x: 0,
          y: 0,
          width: 1600,
          height: 900,
          elements: [
            expect.objectContaining({
              id: 'slide:hello/title:0',
              kind: 'title',
              text: 'Hello World',
              x: 160,
              y: 390,
              width: 1280,
              height: 120,
            }),
          ],
        }),
      ],
    })
  })

  it('rejects source outside the hello-world grammar', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    let error: unknown
    await ctx.plugin({
      name: 'mindppt-parser-error-test',
      inject: [serviceName],
      apply(child: Context) {
        try {
          child.mindpptParser.compile('not mindppt')
        } catch (caught) {
          error = caught
        }
      },
    })

    expect(error instanceof MindPptSyntaxError).toBe(true)
  })
})
