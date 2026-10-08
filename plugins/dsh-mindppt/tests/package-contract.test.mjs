import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const packageUrl = new URL('../package.json', import.meta.url)
const patchUrl = new URL('../cordis.patch.yml', import.meta.url)

describe('DSH package compatibility contract', () => {
  it('keeps package identity and runtime compatibility distinct from the dev baseline', async () => {
    const manifest = JSON.parse(await readFile(packageUrl, 'utf8'))

    expect(manifest.name).toBe('dsh-mindppt-plugin')
    // DSH exposes the Skill registry through the Host's injected 'skills' service.
    expect(manifest.files).toContain('assets')
    expect(manifest.peerDependencies['@deepseek-ai/dsh-client-ui-sidebar-right'])
      .toBe('>=0.2.0-rc.2')
    expect(manifest.devDependencies['@deepseek-ai/dsh-client-ui-sidebar-right'])
      .toBe('0.2.0-rc.2')
  })

  it('mounts the renamed package exactly once on the stable mindppt row', async () => {
    const patch = await readFile(patchUrl, 'utf8')
    const packageRows = patch.match(/name:\s*dsh-mindppt-plugin\b/g) ?? []

    expect(patch).toContain('id: mindppt')
    expect(packageRows).toHaveLength(1)
    expect(patch).not.toContain('dsh-mindppt-dsh')
  })
})
