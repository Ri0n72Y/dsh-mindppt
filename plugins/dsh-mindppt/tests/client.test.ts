import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import {
  relatedReader,
  type WorkspaceFilesRemote,
} from '../src/client/dsh.ts'
import {
  queueClientSelection,
  trackClientWrite,
  waitForClientWrites,
} from '../src/client/client-write-queue.ts'

vi.mock('../src/client/Document.tsx', () => ({
  MindPptDocument: () => null,
}))
vi.mock('../src/client/PreviewPage.tsx', () => ({
  PreviewPage: () => null,
}))

describe('MindPPT client dependency boundaries', () => {
  it('rejects escaping related asset paths before privileged Workspace reads', async () => {
    const reads: Array<{ path: string; baseFile?: string }> = []
    const remote: WorkspaceFilesRemote = {
      async readBytes(_sessionId, path, options) {
        reads.push(options.baseFile === undefined
          ? { path }
          : { path, baseFile: options.baseFile })
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

  it('waits for DSH client services and disposes registrations with its fiber', async () => {
    const {
      apply: applyClient,
      inject: clientInject,
    } = await import('../src/client/index.tsx')
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
      ctx.provide('remote.workspaceFiles' as never, workspaceFiles as never)
      await Promise.resolve()
      expect(previewRegistrations).toBe(0)
      expect(slotRegistrations).toBe(0)

      ctx.provide('sidebarRight' as never, {
        active() { return undefined },
      } as never)
      await fiber.await()
      expect(previewRegistrations).toBe(1)
      expect(slotRegistrations).toBe(1)

      await fiber.dispose()
      expect(previewDisposals).toBe(1)
      expect(slotDisposals).toBe(1)
    } finally {
      await ctx.fiber.dispose()
      vi.unstubAllGlobals()
    }
  })
})


describe('MindPPT client write barrier', () => {
  it('waits for the queued write snapshot without absorbing later writes', async () => {
    const first = Promise.withResolvers<void>()
    const second = Promise.withResolvers<void>()
    trackClientWrite('s-write-barrier', first.promise)
    const waiting = waitForClientWrites('s-write-barrier')
    trackClientWrite('s-write-barrier', second.promise)

    let settled = false
    void waiting.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    first.resolve()
    await waiting
    expect(settled).toBe(true)
    second.resolve()
  })
})


describe('MindPPT client selection queue', () => {
  it('preserves selection request order within one session', async () => {
    const release = Promise.withResolvers<void>()
    const order: string[] = []
    const first = queueClientSelection(
      's-selection-order',
      Promise.resolve(),
      async () => {
        order.push('first')
        await release.promise
      },
    )
    const second = queueClientSelection(
      's-selection-order',
      Promise.resolve(),
      async () => { order.push('second') },
    )

    await Promise.resolve()
    expect(order).toEqual(['first'])
    release.resolve()
    await Promise.all([first, second])
    expect(order).toEqual(['first', 'second'])
  })
})
