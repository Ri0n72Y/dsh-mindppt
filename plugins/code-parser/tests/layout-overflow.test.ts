import { readFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { compileSource } from '../src/compiler.ts'
import { contentOverflowWarnings } from '../src/layout-overflow.ts'
import MindPptParserService, { MindPptCompileError } from '../src/index.ts'
import type { MindPptDiagnostic } from '../src/types.ts'

const CORPUS = readFileSync(
  new URL('../../../examples/layout-p0-p1-qa.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('P0/P1 slide-local semantic overflow diagnostics', () => {
  it('warns only for overrun hero/title-content/left-slot boxes at exact source spans', () => {
    const diagnostics: MindPptDiagnostic[] = []
    const structure = compileSource(CORPUS, diagnostics)

    expect(structure.slides.map(slide => slide.id)).toEqual([
      'hero-fit', 'hero-overflow', 'title-overflow', 'slot-overflow',
      'cjk-long', 'image-ratios', 'dense-data', 'extensions',
    ])
    expect(diagnostics.map(diagnostic => diagnostic.message)).toEqual([
      'Slide "hero-overflow" list semantic content box exceeds 1280×720 slide bounds',
      'Slide "title-overflow" list semantic content box exceeds 1280×720 slide bounds',
      'Slide "slot-overflow" left slot list semantic content box exceeds 1280×720 slide bounds',
    ])
    expect(diagnostics.every(diagnostic => diagnostic.severity === 'warning'))
      .toBe(true)
    const ranges = diagnostics.map(diagnostic => {
      const range = diagnostic.sourceRange!
      return CORPUS.slice(range.start, range.end)
    })
    expect(ranges[0]).toMatch(/^  - Hero item one[\s\S]*  - Hero item four$/)
    expect(ranges[1]).toMatch(/^  - Body item one[\s\S]*  - Body item four$/)
    expect(ranges[2]).toMatch(/^    - Left item one[\s\S]*    - Left item four$/)
    expect(diagnostics[0]!.sourceRange!.start)
      .toBe(CORPUS.indexOf('  - Hero item one'))
    expect(diagnostics[0]!.sourceRange!.start)
      .toBeGreaterThan(CORPUS.indexOf('🧭'))
  })

  it('preserves existing element identities and exact geometry, including tree world offsets', () => {
    const diagnostics: MindPptDiagnostic[] = []
    const first = compileSource(CORPUS, diagnostics)
    expect(compileSource(CORPUS)).toEqual(first)

    const findBox = (slideId: string, id: string) =>
      first.slides.find(slide => slide.id === slideId)!
        .elements.find(element => element.id === id)

    expect(findBox('hero-overflow', 'slide:hero-overflow/list:0')).toMatchObject({
      x: 160, y: 738, width: 960, height: 176,
    })
    expect(findBox('title-overflow', 'slide:title-overflow/list:0')).toMatchObject({
      x: 128, y: 686, width: 1024, height: 176,
    })
    expect(findBox('slot-overflow', 'slide:slot-overflow/left/list:0')).toMatchObject({
      x: 96, y: 678, width: 520, height: 176, slot: 'left',
    })
    expect(first.slides.find(slide => slide.id === 'hero-overflow')?.x)
      .toBe(1880)
    expect(first.tree?.edges).toHaveLength(7)
    expect(first.slides.find(slide => slide.id === 'cjk-long')?.elements)
      .toHaveLength(3)
    expect(diagnostics).toHaveLength(3)
  })

  it('uses local slide bounds rather than world/frame coordinates with tiny tolerance', () => {
    const slide = compileSource('mindppt\nslide local {\n  # Title\n}\n').slides[0]!
    const box = slide.elements[0]!
    const warnings = contentOverflowWarnings([{
      ...slide,
      x: -1880,
      y: 9000,
      elements: [
        { ...box, x: -0.1 },
        { ...box, y: -0.1 },
        { ...box, x: 1200, width: 100 },
        { ...box, y: 700, height: 30 },
        { ...box, x: -1e-7 },
      ],
    }])

    expect(warnings).toHaveLength(4)
    expect(warnings.every(w => w.severity === 'warning')).toBe(true)
    expect(warnings.every(w => w.sourceRange === box.sourceRange)).toBe(true)
  })

  it('publishes warnings on successful compile without changing last-good semantics', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    let parser!: MindPptParserService
    await ctx.plugin({
      name: 'mindppt-layout-overflow-service-test',
      inject: ['mindpptParser'],
      apply(child: Context) { parser = child.mindpptParser },
    })

    try {
      const warningStructure = parser.compile(CORPUS)
      expect(parser.structure).toBe(warningStructure)
      expect(parser.diagnostics).toHaveLength(3)
      expect(parser.diagnostics.every(d => d.severity === 'warning')).toBe(true)

      const fitting = parser.compile('mindppt\nslide simple {\n  # Fits\n}\n')
      expect(parser.structure).toBe(fitting)
      expect(parser.diagnostics).toEqual([])

      expect(() => parser.compile('mindppt\nslide broken {\n  # Broken\n'))
        .toThrow(MindPptCompileError)
      expect(parser.structure).toBe(fitting)
      expect(parser.diagnostics[0]?.severity).toBe('error')
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
