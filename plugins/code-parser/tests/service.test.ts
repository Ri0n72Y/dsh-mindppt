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

const M4 = readFileSync(
  new URL('../../../examples/m4-branching-lr-tree.mindppt', import.meta.url),
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

  it('compiles the canonical M4 branching tree with deterministic non-overlapping geometry', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    let first: ReturnType<MindPptParserService['compile']> | undefined
    let second: ReturnType<MindPptParserService['compile']> | undefined

    await ctx.plugin({
      name: 'mindppt-parser-m4-branching-test',
      inject: [serviceName],
      apply(child: Context) {
        first = child.mindpptParser.compile(M4)
        second = child.mindpptParser.compile(M4)
      },
    })

    expect(first?.slides.map((slide) => slide.id)).toEqual([
      'intro',
      'market',
      'problem',
      'customer',
      'competitor',
      'solution',
    ])
    expect(first?.tree?.edges.map((edge) => edge.id)).toEqual([
      'tree:intro->market',
      'tree:intro->problem',
      'tree:market->customer',
      'tree:market->competitor',
      'tree:problem->solution',
    ])

    const slides = first?.slides ?? []
    const byId = new Map(slides.map((slide) => [slide.id, slide]))

    for (const edge of first?.tree?.edges ?? []) {
      const parent = byId.get(edge.from)
      const child = byId.get(edge.to)
      expect(parent).toBeDefined()
      expect(child).toBeDefined()
      expect(child!.x).toBeGreaterThan(parent!.x)
    }

    expect(byId.get('market')?.y).not.toBe(byId.get('problem')?.y)
    expect(byId.get('customer')?.y).not.toBe(byId.get('competitor')?.y)

    for (let index = 0; index < slides.length; index += 1) {
      for (let other = index + 1; other < slides.length; other += 1) {
        expect(rectanglesOverlap(slides[index]!, slides[other]!)).toBe(false)
      }
    }

    const firstPositions = Object.fromEntries(
      slides.map((slide) => [slide.id, [slide.x, slide.y]]),
    )
    const secondPositions = Object.fromEntries(
      (second?.slides ?? []).map((slide) => [slide.id, [slide.x, slide.y]]),
    )
    expect(secondPositions).toEqual(firstPositions)
  })

  it('anchors unsupported tree direction diagnostics to the tree declaration', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    const source = `mindppt

tree TB {
  intro --> market
}

slide intro {
  # Introduction
}

slide market {
  # Market
}
`

    let diagnosticSlice: string | undefined

    await ctx.plugin({
      name: 'mindppt-parser-direction-range-test',
      inject: [serviceName],
      apply(child: Context) {
        try {
          child.mindpptParser.compile(source)
        } catch {
          // Expected compile failure.
        }

        const diagnostic = child.mindpptParser.diagnostics[0]
        expect(diagnostic?.message).toContain('tree direction LR only')

        const range = diagnostic?.sourceRange
        diagnosticSlice = range
          ? source.slice(range.start, range.end)
          : undefined
      },
    })

    expect(diagnosticSlice).toBe('tree TB {')
  })

  it('anchors empty tree diagnostics to the empty tree block', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    const source = `mindppt

tree LR {
}

slide intro {
  # Introduction
}
`

    let diagnosticSlice: string | undefined

    await ctx.plugin({
      name: 'mindppt-parser-empty-tree-range-test',
      inject: [serviceName],
      apply(child: Context) {
        try {
          child.mindpptParser.compile(source)
        } catch {
          // Expected compile failure.
        }

        const diagnostic = child.mindpptParser.diagnostics[0]
        expect(diagnostic?.message).toContain(
          'Tree must contain at least one edge',
        )

        const range = diagnostic?.sourceRange
        diagnosticSlice = range
          ? source.slice(range.start, range.end)
          : undefined
      },
    })

    expect(diagnosticSlice).toBe(`tree LR {
}`)
  })

  it('keeps the last successful structure when live compilation fails', async () => {
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
    let lastGood: ReturnType<MindPptParserService['compile']> | undefined

    await ctx.plugin({
      name: 'mindppt-parser-reference-test',
      inject: [serviceName],
      apply(child: Context) {
        lastGood = child.mindpptParser.compile(M2)

        try {
          child.mindpptParser.compile(source)
        } catch (caught) {
          error = caught
        }

        expect(child.mindpptParser.source).toBe(source)
        expect(child.mindpptParser.structure).toBe(lastGood)
        expect(child.mindpptParser.diagnostics).toEqual([
          expect.objectContaining({
            severity: 'error',
            message: expect.stringContaining('Unknown slide in tree edge'),
            sourceRange: expect.any(Object),
          }),
        ])
      },
    })

    expect(error).toBeInstanceOf(MindPptCompileError)
    expect((error as Error).message).toContain('Unknown slide in tree edge')
  })
  it('resolves every tree edge and anchors a later unknown reference to that edge', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    const source = `mindppt

tree LR {
  intro --> market
  market --> missing
}

slide intro {
  # Introduction
}

slide market {
  # Market
}
`

    let diagnosticSlice: string | undefined

    await ctx.plugin({
      name: 'mindppt-parser-later-reference-test',
      inject: [serviceName],
      apply(child: Context) {
        try {
          child.mindpptParser.compile(source)
        } catch {
          // Expected compile failure.
        }

        const diagnostic = child.mindpptParser.diagnostics[0]
        expect(diagnostic?.message).toContain('Unknown slide in tree edge')

        const range = diagnostic?.sourceRange
        diagnosticSlice = range
          ? source.slice(range.start, range.end)
          : undefined
      },
    })

    expect(diagnosticSlice).toBe('  market --> missing')
  })
)

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}
