import { describe, expect, it } from 'vitest'
import { workspaceFilePort } from '../src/fs-port.ts'

describe('DSH workspace file port', () => {
  it('publishes the post-write version after a guarded write succeeds', async () => {
    const observed: Array<{ path: string; version: string }> = []
    const fs = {
      async resolve(path: string, options?: { cwd?: string }) {
        return { displayPath: options?.cwd ? options.cwd + '/' + path : path }
      },
      contains() { return true },
      async stat() { return { version: 'v1' } },
      async readText() { return 'mindppt\n' },
      async writeText() { return { version: 'v2' } },
    }
    const sessions = {
      get() { return { header: { cwd: '/workspace' } } },
    }
    const port = workspaceFilePort(
      fs,
      sessions,
      (target, version) => {
        observed.push({ path: target.displayPath, version })
      },
    )

    await expect(port.writeText(
      { sessionId: 's1', path: 'deck.mindppt' },
      'mindppt\n',
      'v1',
    )).resolves.toBe('v2')
    expect(observed).toEqual([
      { path: '/workspace/deck.mindppt', version: 'v2' },
    ])
  })

  it('does not publish a change when the guarded write fails', async () => {
    let observed = 0
    const fs = {
      async resolve(path: string, options?: { cwd?: string }) {
        return { displayPath: options?.cwd ? options.cwd + '/' + path : path }
      },
      contains() { return true },
      async stat() { return { version: 'v1' } },
      async readText() { return 'mindppt\n' },
      async writeText() {
        throw Object.assign(new Error('stale'), { code: 'FS_STALE_VERSION' })
      },
    }
    const sessions = {
      get() { return { header: { cwd: '/workspace' } } },
    }
    const port = workspaceFilePort(fs, sessions, () => { observed += 1 })

    await expect(port.writeText(
      { sessionId: 's1', path: 'deck.mindppt' },
      'mindppt\n',
      'v1',
    )).rejects.toMatchObject({ code: 'FS_STALE_VERSION' })
    expect(observed).toBe(0)
  })
})
