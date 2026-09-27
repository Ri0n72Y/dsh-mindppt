import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, {
  MindPptCompileError,
  serviceName,
} from '../src/index.ts'

const M2 = readFileSync(
  new URL('../../../examples/m2-content-profile.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('MindPptParserService', () => {
  it('compiles the M2 content profile into a resolved structure', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    let structure: ReturnType<MindPptParserService['compile']> | undefined
    await ctx.plugin({
      name: 'mindppt-parser-compile-test',
      inject: [serviceName],
      apply(child: Context) {
        structure = child.mindpptParser.compile(M2)
      },
    })

    expect(structure?.slides[0]).toEqual(expect.objectContaining({
      id: 'overview',
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    }))
    expect(structure?.slides[0]?.elements).toEqual([
      expect.objectContaining({
        id: 'slide:overview/title:0',
        kind: 'title',
        text: 'Outdoor Market',
      }),
      expect.objectContaining({
        id: 'slide:overview/subtitle:0',
        kind: 'subtitle',
        text: '2026 snapshot',
      }),
      expect.objectContaining({
        id: 'slide:overview/text:0',
        kind: 'text',
        text: 'Demand remains seasonal.',
      }),
      expect.objectContaining({
        id: 'slide:overview/list:0',
        kind: 'list',
        ordered: false,
        items: ['Premium products gain share', 'Online channels continue growing'],
      }),
      expect.objectContaining({
        id: 'slide:overview/list:1',
        kind: 'list',
        ordered: true,
        items: ['Confirm positioning', 'Compare substitutes'],
      }),
    ])

    expect(structure?.slides[1]?.elements.slice(0, 2)).toEqual([
      expect.objectContaining({
        id: 'slide:math/text:0',
        kind: 'text',
        text: 'A compact mathematical example.',
      }),
      expect.objectContaining({
        id: 'slide:math/text:1',
        kind: 'text',
        text: 'Need --> Product',
      }),
    ])

    const extension = structure?.slides[1]?.elements.at(-1)
    expect(extension).toEqual(expect.objectContaining({
      id: 'slide:math/extension:0',
      kind: 'extension',
      type: 'latex',
      raw: '  e^{i\\pi} + 1 = 0',
    }))

    expect(structure?.tree?.edges[0]).toEqual(expect.objectContaining({
      id: 'tree:overview->math',
      from: 'overview',
      to: 'math',
    }))

    const range = extension?.sourceRange
    expect(range && M2.slice(range.start, range.end)).toBe(
      '  \`\`\`latex\n  e^{i\\pi} + 1 = 0\n  \`\`\`',
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
