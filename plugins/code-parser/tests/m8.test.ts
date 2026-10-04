import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from '../src/index.ts'

const M8 = readFileSync(
  new URL(
    '../../../examples/m8-soft-links-presentation-paths.mindppt',
    import.meta.url,
  ),
  'utf8',
).replace(/\r\n/g, '\n')

async function createParser() {
  const ctx = new Context()
  await ctx.plugin(MindPptParserService)
  let parser: MindPptParserService | undefined

  await ctx.plugin({
    name: 'mindppt-m8-parser-test-driver',
    inject: ['mindpptParser'],
    apply(child: Context) {
      parser = child.mindpptParser
    },
  })

  if (!parser) throw new Error('Parser test runtime did not initialize')
  return parser
}

describe('M8 SoftLink and PresentationPath semantics', () => {
  it('compiles deterministic relations without changing tree geometry', async () => {
    const parser = await createParser()
    const first = parser.compile(M8)
    const second = parser.compile(M8)

    expect(second).toEqual(first)
    expect(first.links).toEqual([
      expect.objectContaining({
        id: 'link:customer->summary',
        fromSlideId: 'customer',
        toSlideId: 'summary',
      }),
    ])
    expect(first.paths?.map(({ id, name }) => [id, name])).toEqual([
      ['path:main', 'main'],
      ['path:short', 'short'],
    ])
    expect(first.paths?.[0]?.occurrences.map(
      ({ id, slideId }) => [id, slideId],
    )).toEqual([
      ['path:main/occurrence:0', 'hero'],
      ['path:main/occurrence:1', 'agenda'],
      ['path:main/occurrence:2', 'customer'],
      ['path:main/occurrence:3', 'analysis'],
      ['path:main/occurrence:4', 'customer'],
      ['path:main/occurrence:5', 'summary'],
    ])

    const link = first.links?.[0]
    const repeated = first.paths?.[0]?.occurrences[4]
    expect(link && M8.slice(link.sourceRange.start, link.sourceRange.end))
      .toBe('link customer -.-> summary')
    expect(repeated && M8.slice(
      repeated.sourceRange.start,
      repeated.sourceRange.end,
    )).toBe('  customer')

    const withoutM8 = M8
      .replace('link customer -.-> summary\n\n', '')
      .replace(/\npath main \{[\s\S]*$/, '\n')
    const base = parser.compile(withoutM8)

    expect(first.slides.map(({ id, x, y }) => [id, x, y]))
      .toEqual(base.slides.map(({ id, x, y }) => [id, x, y]))
    expect(first.tree?.edges.map(({ id, from, to }) => [id, from, to]))
      .toEqual(base.tree?.edges.map(({ id, from, to }) => [id, from, to]))
  })

  it('accepts reverse links, forward references, and repeated occurrences', async () => {
    const parser = await createParser()
    const source = `mindppt

link a -.-> b
link b -.-> a

path repeat {
  a
  a
  b
}

tree LR {
  a --> b
}

slide a {
  # A
}

slide b {
  # B
}
`
    const structure = parser.compile(source)

    expect(structure.links?.map(({ id }) => id)).toEqual([
      'link:a->b',
      'link:b->a',
    ])
    expect(structure.paths?.[0]?.occurrences.map(({ slideId }) => slideId))
      .toEqual(['a', 'a', 'b'])
  })

  it('anchors M8 semantic errors to the offending declaration', async () => {
    const parser = await createParser()
    const cases = [
      ['link missing -.-> b', 'Unknown SoftLink source slide: missing'],
      ['link a -.-> missing', 'Unknown SoftLink target slide: missing'],
      ['link a -.-> a', 'SoftLink cannot target its source slide: a'],
      [
        'link a -.-> b\nlink a -.-> b',
        'Duplicate SoftLink: a -.-> b',
      ],
      [
        'path one {\n  a\n}\npath one {\n  b\n}',
        'Duplicate PresentationPath: one',
      ],
      ['path empty {\n}', 'PresentationPath "empty" must not be empty'],
      [
        'path one {\n  missing\n}',
        'Unknown slide in PresentationPath "one": missing',
      ],
    ] as const

    for (const [body, message] of cases) {
      const source = `mindppt

${body}

tree LR {
  a --> b
}

slide a {
  # A
}

slide b {
  # B
}
`
      expect(() => parser.compile(source)).toThrow(message)
      expect(parser.diagnostics[0]?.sourceRange).toBeDefined()
      const range = parser.diagnostics[0]!.sourceRange!
      const slice = source.slice(range.start, range.end)
      expect(body.includes(slice.trim())).toBe(true)
    }
  })

  it('keeps tree reachability independent from SoftLinks', async () => {
    const parser = await createParser()
    parser.compile(`mindppt

tree LR {
  a --> b
}

link a -.-> orphan

slide a {
  # A
}

slide b {
  # B
}

slide orphan {
  # Orphan
}
`)

    expect(parser.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: 'Slide "orphan" is unreachable from primary tree root "a"',
      }),
    ])
  })
})
