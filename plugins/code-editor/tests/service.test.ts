import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptEditorService, { serviceName } from '../src/index.ts'

const M2 = readFileSync(
  new URL('../../../examples/m2-content-profile.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('MindPptEditorService', () => {
  it('compiles source changes while preserving the parser last-good structure', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptEditorService)

    await ctx.plugin({
      name: 'mindppt-editor-test-driver',
      inject: [serviceName, 'mindpptParser'],
      apply(child: Context) {
        expect(child.mindpptEditor.setSource(M2)).toBe(true)

        const lastGood = child.mindpptParser.structure
        const invalid = M2.slice(0, -2)

        expect(child.mindpptEditor.setSource(invalid)).toBe(false)
        expect(child.mindpptEditor.source).toBe(invalid)
        expect(child.mindpptParser.source).toBe(invalid)
        expect(child.mindpptParser.structure).toBe(lastGood)
        expect(child.mindpptParser.diagnostics[0]).toEqual(
          expect.objectContaining({
            severity: 'error',
            message: expect.stringContaining('Expected block-end'),
          }),
        )
      },
    })
  })
})
