import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, { serviceName } from '../src/index.ts'

describe('MindPptParserService', () => {
  it('provides and disposes the Cordis service with its plugin fiber', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(MindPptParserService)

    expect(ctx.mindpptParser).toBeInstanceOf(MindPptParserService)
    expect(ctx.get(serviceName)).toBe(ctx.mindpptParser)

    await fiber.dispose()

    expect(ctx.get(serviceName)).toBeUndefined()
  })
})
