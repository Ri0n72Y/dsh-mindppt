import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, {
  MindPptCompileError,
  serviceName,
} from '../src/index.ts'

const PARAGRAPH =
  '中文段落用于验证编译器拥有文本几何并覆盖实际换行边界'.repeat(4)
const ITEM =
  '宽字符列表项用于验证中文与全角字符不会扩大容器ＷＭ🙂'.repeat(2)
const WHITESPACE_SEGMENT = 'word\tword        '

describe('M6 text geometry', () => {
  it('sizes CJK paragraph and wide-glyph list in the compiler', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m6-wide-text-test',
      inject: [serviceName],
      apply(child: Context) {
        const slide = child.mindpptParser.compile(wideSource()).slides[0]

        expect(slide?.elements).toEqual([
          expect.objectContaining({
            id: 'slide:fit/title:0',
            x: 96,
            y: 56,
            width: 1088,
            height: 84,
          }),
          expect.objectContaining({
            id: 'slide:fit/text:0',
            x: 128,
            y: 184,
            width: 1024,
            height: 100,
          }),
          expect.objectContaining({
            id: 'slide:fit/list:0',
            x: 128,
            y: 304,
            width: 1024,
            height: 280,
          }),
        ])
      },
    })
  })

  it('fails at the first CJK codepoint beyond the semantic region', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m6-cjk-overflow-test',
      inject: [serviceName],
      apply(child: Context) {
        const fits = '界'.repeat(630)
        const overflows = fits + '界'
        expect(() => child.mindpptParser.compile(bodySource(fits))).not.toThrow()

        const invalidSource = bodySource(overflows)
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
            invalidSource
              .slice(error.sourceRange.start, error.sourceRange.end)
              .trim(),
          ).toBe(overflows)
        }
      },
    })
  })

  it('preserves tabs and repeated spaces at the semantic boundary', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m6-whitespace-text-test',
      inject: [serviceName],
      apply(child: Context) {
        const fits = WHITESPACE_SEGMENT.repeat(45).trim()
        const overflows = WHITESPACE_SEGMENT.repeat(46).trim()
        const slide = child.mindpptParser.compile(bodySource(fits)).slides[0]

        expect(slide?.elements.find((element) => element.kind === 'text'))
          .toEqual(expect.objectContaining({ height: 460 }))

        const invalidSource = bodySource(overflows)
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
            invalidSource
              .slice(error.sourceRange.start, error.sourceRange.end)
              .trim(),
          ).toBe(overflows)
        }
      },
    })
  })


})

function wideSource(): string {
  return [
    'mindppt',
    '',
    'slide fit {',
    '  layout title-content',
    '',
    '  # Geometry contract',
    '',
    '  ' + PARAGRAPH,
    '',
    '  - ' + ITEM,
    '  - ' + ITEM,
    '  - ' + ITEM,
    '}',
    '',
  ].join('\n')
}

function bodySource(body: string): string {
  return [
    'mindppt',
    '',
    'slide fit {',
    '  layout title-content',
    '',
    '  # Boundary',
    '',
    '  ' + body,
    '}',
    '',
  ].join('\n')
}

