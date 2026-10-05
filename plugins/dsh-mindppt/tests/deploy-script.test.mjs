import { describe, expect, it, vi } from 'vitest'
import { buildDeployArgs, main } from '../../../scripts/deploy-dsh.mjs'

const webDump = `
- id: connection
- id: workspace-files
- id: ui-sidebar-documentpreview
`

const activeDump = `${webDump}- id: mindppt\n`

function result(status, stdout = '', stderr = '') {
  return { status, stdout, stderr, error: undefined }
}

describe('DSH deploy argument construction', () => {
  it('defaults to the mindppt profile', () => {
    expect(buildDeployArgs([])).toEqual({
      profile: 'mindppt',
      args: ['plugin', '--profile', 'mindppt', 'add', './plugins/dsh-mindppt'],
    })
  })

  it('preserves an explicit profile without injecting mindppt', () => {
    expect(buildDeployArgs(['--profile', 'review'])).toEqual({
      profile: 'review',
      args: ['plugin', '--profile', 'review', 'add', './plugins/dsh-mindppt'],
    })
    expect(buildDeployArgs(['--profile=review'])).toEqual({
      profile: 'review',
      args: ['plugin', '--profile=review', 'add', './plugins/dsh-mindppt'],
    })
  })

  it('forwards unrelated pnpm arguments in order', () => {
    expect(buildDeployArgs(['--offline', '--save-exact'])).toEqual({
      profile: 'mindppt',
      args: [
        'plugin', '--profile', 'mindppt', 'add', './plugins/dsh-mindppt',
        '--offline', '--save-exact',
      ],
    })
  })
})

describe('DSH deploy process flow', () => {
  it('creates a missing profile from the official web template', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce(result(0, '0.2.0-rc.2\n'))
      .mockReturnValueOnce(result(1, '', 'profile missing\n'))
      .mockReturnValueOnce(result(0, webDump))
      .mockReturnValueOnce(result(0))
      .mockReturnValueOnce(result(0, activeDump))

    expect(main([], spawn)).toBe(0)
    expect(spawn.mock.calls[2]?.[1]).toEqual([
      'dsh', '--profile', 'mindppt', '--from-default-profile', 'web',
      '--dump-default-config',
    ])
  })

  it('propagates the plugin command exit code', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce(result(0, '0.2.0-rc.2\n'))
      .mockReturnValueOnce(result(0, webDump))
      .mockReturnValueOnce(result(23))

    expect(main([], spawn)).toBe(23)
  })
})
