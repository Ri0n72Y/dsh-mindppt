import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Same provider contract as the official DSH rc2 / alpha.1 bundled skill.
const body = new URL('../assets/mindppt-authoring/SKILL.md', import.meta.url)
const resourceBase = {
  kind: 'directory' as const,
  path: fileURLToPath(new URL('../assets/mindppt-authoring/', import.meta.url)),
}
const candidate = {
  name: 'mindppt-authoring',
  description: 'Author, edit, debug, or repair .mindppt presentations in a DSH workspace using implemented MindPPT v0 syntax and standard file read/edit/write tools.',
  invocation: { modelInvocable: true, userInvocable: true },
  provider: 'mindppt-authoring',
  source: 'bundled',
  resourceBase,
  rank: 600, // BUNDLED_SKILL_RANK in DSH rc2 and alpha.1
  locator: body,
} as const

const provider = {
  name: 'mindppt-authoring',
  list: async () => [candidate],
  async get() {
    return {
      name: candidate.name,
      description: candidate.description,
      invocation: candidate.invocation,
      provider: candidate.provider,
      source: candidate.source,
      resourceBase,
      content: await readFile(body, 'utf8'),
    }
  },
}

export function registerMindPptSkill(skills: {
  registerProvider(factory: () => typeof provider): unknown
}): void {
  skills.registerProvider(() => provider)
}
