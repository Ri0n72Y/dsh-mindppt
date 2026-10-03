import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService, { serviceName } from '../src/index.ts'

const PARAGRAPH =
  '中文段落用于验证编译器拥有文本几何并覆盖实际换行边界'.repeat(4)
const ITEM =
  '宽字符列表项用于验证中文与全角字符不会扩大容器ＷＭ🙂'.repeat(2)

describe('M6 text geometry', () => {
  it('sizes CJK paragraph and wide-glyph list in the compiler', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)

    await ctx.plugin({
      name: 'mindppt-m6-wide-text-test',
      inject: [serviceName],
      apply(child: Context) {
        const slide = child.mindpptParser.compile(source()).slides[0]

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
})

function source(): string {
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
