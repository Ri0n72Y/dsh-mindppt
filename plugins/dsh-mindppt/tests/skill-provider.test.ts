import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { registerMindPptSkill } from '../src/skill-provider.ts'

describe('bundled MindPPT Skill provider', () => {
  it('discovers and loads the published body and resources outside plugin cwd', async () => {
    let factory: (() => unknown) | undefined
    registerMindPptSkill({
      registerProvider(next) { factory = next },
    })
    const provider = factory?.() as {
      list(options: { cwd: string }): Promise<Array<{ name: string; resourceBase: { path: string } }>>
      get(candidate: unknown, options: { cwd: string }): Promise<{ content: string; resourceBase: { path: string } }>
    }
    const otherWorkspace = '/unrelated/workspace'
    const candidate = (await provider.list({ cwd: otherWorkspace }))[0]
    expect(candidate?.name).toBe('mindppt-authoring')
    const skill = await provider.get(candidate, { cwd: otherWorkspace })
    expect(skill.content).toContain('standard DSH')
    expect(skill.resourceBase.path).not.toContain(otherWorkspace)
    const grammar = await readFile(skill.resourceBase.path + '/references/v0-grammar.md', 'utf8')
    expect(grammar).toContain('chart bar')
    const source = await readFile(
      skill.resourceBase.path + '/examples/authoring-demo.mindppt', 'utf8',
    )
    expect(source).toContain('mindppt')
  })
})
