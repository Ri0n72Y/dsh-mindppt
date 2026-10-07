import { describe, expect, it } from 'vitest'
import {
  MindPptWorkspaceController,
  type WorkspaceFilePort,
} from '../src/controller.ts'
import { workspaceFilePort } from '../src/fs-port.ts'

const A = 'mindppt\n\nslide root {\n  # Root\n}\n'
const B = 'mindppt\n\nslide b {\n  # B\n}\n'

describe('workspace controller selection races', () => {
  it('rejects an Agent patch while a newer document selection is pending', async () => {
    const bRead = Promise.withResolvers<string>()
    let writes = 0
    const port: WorkspaceFilePort = {
      async readText(identity) {
        return identity.path === 'b.mindppt' ? await bRead.promise : A
      },
      async readSnapshot() {
        return { source: A, version: '1' }
      },
      async writeText() {
        writes += 1
        return '2'
      },
    }
    const controller = new MindPptWorkspaceController(port)
    await controller.select(
      { sessionId: 's1', path: 'a.mindppt' },
      undefined,
      'tab-a',
    )
    const selecting = controller.select(
      { sessionId: 's1', path: 'b.mindppt' },
      undefined,
      'tab-b',
    )

    expect(() => controller.inspect('s1')).toThrow(
      'stale MindPPT document selection',
    )
    const result = await controller.guardedPatch('s1', {
      start: A.indexOf('Root'),
      end: A.indexOf('Root') + 4,
      expected: 'Root',
      replacement: 'Agent',
    })
    expect(result).toEqual({
      ok: false,
      reason: 'stale patch: MindPPT selection changed',
    })
    expect(writes).toBe(0)

    bRead.resolve(B)
    await selecting
    expect(controller.inspect('s1').file.path).toBe('b.mindppt')
  })

  it('cancels an in-flight Agent patch when selection changes during its read', async () => {
    const snapshotStarted = Promise.withResolvers<void>()
    const releaseSnapshot = Promise.withResolvers<void>()
    const sources = new Map([
      ['a.mindppt', A],
      ['b.mindppt', B],
    ])
    let writes = 0
    const port: WorkspaceFilePort = {
      async readText(identity) {
        return sources.get(identity.path) ?? A
      },
      async readSnapshot(identity) {
        snapshotStarted.resolve()
        await releaseSnapshot.promise
        return { source: sources.get(identity.path) ?? A, version: '1' }
      },
      async writeText() {
        writes += 1
        return '2'
      },
    }
    const controller = new MindPptWorkspaceController(port)
    await controller.select(
      { sessionId: 's1', path: 'a.mindppt' },
      undefined,
      'tab-a',
    )
    const patching = controller.guardedPatch('s1', {
      start: A.indexOf('Root'),
      end: A.indexOf('Root') + 4,
      expected: 'Root',
      replacement: 'Agent',
    })
    await snapshotStarted.promise
    const selecting = controller.select(
      { sessionId: 's1', path: 'b.mindppt' },
      undefined,
      'tab-b',
    )

    releaseSnapshot.resolve()
    await expect(patching).resolves.toEqual({
      ok: false,
      reason: 'stale patch: MindPPT selection changed',
    })
    expect(writes).toBe(0)
    await selecting
    expect(controller.inspect('s1').file.path).toBe('b.mindppt')
    expect(sources.get('a.mindppt')).toBe(A)
  })

  it('blocks an obsolete Agent patch at the provider commit boundary', async () => {
    const writeResolveStarted = Promise.withResolvers<void>()
    const releaseWriteResolve = Promise.withResolvers<void>()
    const releaseBRead = Promise.withResolvers<void>()
    const persisted = new Map([
      ['/workspace/a.mindppt', A],
      ['/workspace/b.mindppt', B],
    ])
    const versions = new Map([
      ['/workspace/a.mindppt', '1'],
      ['/workspace/b.mindppt', '1'],
    ])
    let aResolveCount = 0
    let providerWrites = 0
    let observed = 0
    const fs = {
      async resolve(path: string, options?: { cwd?: string }) {
        if (path === 'a.mindppt' && ++aResolveCount === 3) {
          writeResolveStarted.resolve()
          await releaseWriteResolve.promise
        }
        return { displayPath: options?.cwd ? options.cwd + '/' + path : path }
      },
      contains() { return true },
      async stat(target: { displayPath: string }) {
        const version = versions.get(target.displayPath)
        return version ? { version } : undefined
      },
      async readText(target: { displayPath: string }) {
        if (target.displayPath === '/workspace/b.mindppt') {
          await releaseBRead.promise
        }
        return persisted.get(target.displayPath) ?? ''
      },
      async writeText(target: { displayPath: string }, source: string) {
        providerWrites += 1
        persisted.set(target.displayPath, source)
        versions.set(target.displayPath, '2')
        return { version: '2' }
      },
    }
    const sessions = {
      get() { return { header: { cwd: '/workspace' } } },
    }
    const controller = new MindPptWorkspaceController(
      workspaceFilePort(fs, sessions, () => { observed += 1 }),
    )
    await controller.select(
      { sessionId: 's1', path: 'a.mindppt' },
      undefined,
      'tab-a',
    )
    const attemptsBefore = controller.attempts('s1')

    const patching = controller.guardedPatch('s1', {
      start: A.indexOf('Root'),
      end: A.indexOf('Root') + 4,
      expected: 'Root',
      replacement: 'Agent',
    })
    await writeResolveStarted.promise
    const selecting = controller.select(
      { sessionId: 's1', path: 'b.mindppt' },
      undefined,
      'tab-b',
    )

    releaseWriteResolve.resolve()
    await expect(patching).resolves.toEqual({
      ok: false,
      reason: 'stale patch: MindPPT selection changed',
    })
    expect(providerWrites).toBe(0)
    expect(observed).toBe(0)
    expect(persisted.get('/workspace/a.mindppt')).toBe(A)
    expect(controller.attempts('s1')).toBe(attemptsBefore)

    releaseBRead.resolve()
    await selecting
    expect(controller.inspect('s1').file.path).toBe('b.mindppt')
  })

  it('drops the previous document if the new active selection fails', async () => {
    const port: WorkspaceFilePort = {
      async readText(identity) {
        if (identity.path === 'b.mindppt') throw new Error('read failed')
        return A
      },
      async readSnapshot() { return { source: A, version: '1' } },
      async writeText() { return '2' },
    }
    const controller = new MindPptWorkspaceController(port)
    await controller.select(
      { sessionId: 's1', path: 'a.mindppt' },
      undefined,
      'tab-a',
    )
    await expect(controller.select(
      { sessionId: 's1', path: 'b.mindppt' },
      undefined,
      'tab-b',
    )).rejects.toThrow('read failed')
    expect(() => controller.inspect('s1')).toThrow(
      'no selected MindPPT document for this session',
    )
  })

  it('only lets the owning tab clear the active document', async () => {
    const port: WorkspaceFilePort = {
      async readText() { return A },
      async readSnapshot() { return { source: A, version: '1' } },
      async writeText() { return '2' },
    }
    const controller = new MindPptWorkspaceController(port)
    await controller.select(
      { sessionId: 's1', path: 'a.mindppt' },
      undefined,
      'tab-a',
    )
    await controller.clear('s1', 'a.mindppt', 'tab-b')
    expect(controller.inspect('s1').file.path).toBe('a.mindppt')
    await controller.clear('s1', 'a.mindppt', 'tab-a')
    expect(() => controller.inspect('s1')).toThrow()
  })
})
