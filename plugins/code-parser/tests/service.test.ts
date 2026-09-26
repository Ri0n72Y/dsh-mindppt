import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, {
  MindPptCompileError,
  serviceName,
} from '../src/index.ts'

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

  it('compiles two slides and one deterministic LR tree edge', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    let structure: ReturnType<MindPptParserService['compile']> | undefined
    await ctx.plugin({
      name: 'mindppt-parser-compile-test',
      inject: [serviceName],
      apply(child: Context) {
        structure = child.mindpptParser.compile(M1)
      },
    })

    expect(structure?.slides).toEqual([
      expect.objectContaining({
        id: 'intro',
        x: 0,
        y: 0,
        width: 1600,
        height: 900,
        elements: [
          expect.objectContaining({
            id: 'slide:intro/title:0',
            kind: 'title',
            text: 'Introduction',
            x: 160,
            y: 390,
          }),
        ],
      }),
      expect.objectContaining({
        id: 'market',
        x: 2200,
        y: 0,
        width: 1600,
        height: 900,
        elements: [
          expect.objectContaining({
            id: 'slide:market/title:0',
            text: 'Market',
          }),
        ],
      }),
    ])

    expect(structure?.tree).toEqual(expect.objectContaining({
      direction: 'LR',
      edges: [
        expect.objectContaining({
          id: 'tree:intro->market',
          from: 'intro',
          to: 'market',
        }),
      ],
    }))

    const introRange = structure?.slides[0]?.sourceRange
    const titleRange = structure?.slides[0]?.elements[0]?.sourceRange
    const edgeRange = structure?.tree?.edges[0]?.sourceRange

    expect(introRange && M1.slice(introRange.start, introRange.end)).toBe(
      'slide intro {\n  # Introduction\n}',
    )
    expect(titleRange && M1.slice(titleRange.start, titleRange.end)).toBe(
      '  # Introduction',
    )
    expect(edgeRange && M1.slice(edgeRange.start, edgeRange.end)).toBe(
      '  intro --> market',
    )
  })

  it('resolves tree references after parsing all slides', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    const source = `mindppt

tree LR {
  missing --> market
}

slide intro {
  # Introduction
}

slide market {
  # Market
}
`

    let error: unknown
    await ctx.plugin({
      name: 'mindppt-parser-reference-test',
      inject: [serviceName],
      apply(child: Context) {
        try {
          child.mindpptParser.compile(source)
        } catch (caught) {
          error = caught
        }
      },
    })

    expect(error).toBeInstanceOf(MindPptCompileError)
    expect((error as Error).message).toContain('Unknown slide in tree edge')
  })
})
