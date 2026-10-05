import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import {
  relatedReader,
  type WorkspaceFilesRemote,
} from '../src/client/dsh.ts'
import {
  apply as applyClient,
  inject as clientInject,
} from '../src/client/index.tsx'

describe('MindPPT client dependency boundaries', () => {
  it('rejects escaping related asset paths before privileged Workspace reads', async () => {
    const reads: Array<{ path: string; baseFile?: string }> = []
    const remote: WorkspaceFilesRemote = {
      async readBytes(_sessionId, path, options) {
        reads.push({ path, baseFile: options.baseFile })
        return {
          ok: true,
          value: {
            absolutePath: '/workspace/' + path.replace(/^\.\//, ''),
            version: 'v1',
            data: new Uint8Array([1]),
            eof: true,
          },
        }
      },
    }
    const read = relatedReader(remote, 's1', 'deck.mindppt')
    const signal = new AbortController().signal

    for (const path of ['./assets/customer.svg', 'assets/customer.svg']) {
      await expect(read(path, signal)).resolves.toBeDefined()
    }
    for (const path of [
      '../secret.png',
      'nested/../../secret.png',
      '/absolute/path.png',
      'C:\\absolute\\path.png',
      'nested\\..\\secret.png',
      'https://example.com/asset.png',
    ]) {
      await expect(read(path, signal)).resolves.toBeUndefined()
    }

    expect(reads).toEqual([
      { path: './assets/customer.svg', baseFile: 'deck.mindppt' },
      { path: 'assets/customer.svg', baseFile: 'deck.mindppt' },
    ])
  })

  it('waits for Cordis services and disposes client registrations with its fiber', async () => {
    vi.stubGlobal('window', { location: { href: 'http://localhost/' } })
    const ctx = new Context()
    let previewRegistrations = 0
    let previewDisposals = 0
    let slotRegistrations = 0
    let slotDisposals = 0
    const workspaceFiles: WorkspaceFilesRemote = {
      async readBytes() {
        return { ok: false, error: { message: 'unused' } }
      },
    }

    try {
      const fiber = ctx.plugin({
        name: 'dsh-mindppt-client-lifecycle-test',
        inject: [...clientInject],
        apply: applyClient,
      })
      expect(previewRegistrations).toBe(0)
      expect(slotRegistrations).toBe(0)

      ctx.provide('documentPreviews' as never, {
        register() {
          previewRegistrations += 1
          return () => { previewDisposals += 1 }
        },
      } as never)
      ctx.provide('slots' as never, {
        inject(_name: string, setup: () => () => void) {
          const dispose = setup()
          return () => dispose()
        },
        register() {
          slotRegistrations += 1
          return () => { slotDisposals += 1 }
        },
      } as never)
      ctx.provide('remote' as never, { workspaceFiles } as never)
      await Promise.resolve()
      expect(previewRegistrations).toBe(0)
      expect(slotRegistrations).toBe(0)

      ctx.provide('remote.workspaceFiles' as never, workspaceFiles as never)
      await Promise.resolve()
      expect(previewRegistrations).toBe(1)
      expect(slotRegistrations).toBe(1)
      await fiber.await()

      await fiber.dispose()
      expect(previewDisposals).toBe(1)
      expect(slotDisposals).toBe(1)
    } finally {
      await ctx.fiber.dispose()
      vi.unstubAllGlobals()
    }
  })
})
