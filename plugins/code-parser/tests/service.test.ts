import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, { serviceName } from '../src/index.ts'

describe('MindPptParserService', () => {
  it('provides the service to injected consumers and removes it on disposal', async () => {
    const ctx = new Context()
    const provider = await ctx.plugin(MindPptParserService)

    let observed: MindPptParserService | undefined
    const consumer = await ctx.plugin({
      name: 'mindppt-parser-test-consumer',
      inject: [serviceName],
      apply(child: Context) {
        observed = child.mindpptParser
      },
    })

    await consumer

    expect(observed instanceof MindPptParserService).toBe(true)
    expect(ctx.get(serviceName) === observed).toBe(true)

    await provider.dispose()

    expect(ctx.get(serviceName) === undefined).toBe(true)
  })
})
