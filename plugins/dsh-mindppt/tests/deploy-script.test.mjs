import { describe, expect, it, vi } from 'vitest'
import {
  buildDeployArgs,
  main,
  resolvePnpmRunner,
} from '../../../scripts/deploy-dsh.mjs'

const webDump = `
- id: connection
- id: workspace-files
- id: ui-sidebar-documentpreview
`

const activeDump = `${webDump}- id: mindppt\n`
const runner = { command: 'pnpm', args: [] }

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

  it('uses the active pnpm JS entry on Windows without a cmd shim', () => {
    expect(resolvePnpmRunner(
      { npm_execpath: 'C:\\pnpm\\pnpm.cjs' },
      'win32',
      'C:\\node\\node.exe',
    )).toEqual({
      command: 'C:\\node\\node.exe',
      args: ['C:\\pnpm\\pnpm.cjs'],
    })
  })
})

describe('DSH deploy process flow', () => {
  it('propagates a failing version command', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce(result(19, '', 'version failed\\n'))

    expect(main([], spawn, runner)).toBe(19)
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('creates a missing profile from the official web template', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce(result(0, '0.2.0-rc.2\n'))
      .mockReturnValueOnce(result(1, '', 'profile missing\n'))
      .mockReturnValueOnce(result(0, webDump))
      .mockReturnValueOnce(result(0))
      .mockReturnValueOnce(result(0, activeDump))

    expect(main([], spawn, runner)).toBe(0)
    expect(spawn.mock.calls[2]?.[1]).toEqual([
      'dsh', '--profile', 'mindppt', '--from-default-profile', 'web',
      '--dump-default-config',
    ])
  })

  it('accepts a newer compatible DSH version without a wrapper exemption', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce(result(0, '0.2.1-alpha.1\\n'))
      .mockReturnValueOnce(result(0, webDump))
      .mockReturnValueOnce(result(0))
      .mockReturnValueOnce(result(0, activeDump))

    expect(main([], spawn, runner)).toBe(0)
    const args = spawn.mock.calls.flatMap(call => call[1])
    expect(args).not.toContain('allow-version')
  })

  it('propagates the plugin command exit code', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce(result(0, '0.2.0-rc.2\n'))
      .mockReturnValueOnce(result(0, webDump))
      .mockReturnValueOnce(result(23))

    expect(main([], spawn, runner)).toBe(23)
  })
})
