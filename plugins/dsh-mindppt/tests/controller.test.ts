import { describe, expect, it } from 'vitest'
import {
  MindPptWorkspaceController,
  type WorkspaceFilePort,
} from '../src/controller.ts'

const VALID = `mindppt

slide root {
  # Root
}
`
const INVALID = `mindppt
slide
`

function memoryFile(initial = VALID) {
  let source = initial
  let writes = 0
  let version = 1
  let staleNextWrite = false
  return {
    port: {
      async readText() { return source },
      async readSnapshot() {
        return { source, version: String(version) }
      },
      async writeText(
        _identity: { sessionId: string; path: string },
        next: string,
        expectedVersion: string,
        _signal?: AbortSignal,
      ) {
        if (
          staleNextWrite
          || expectedVersion !== String(version)
        ) {
          staleNextWrite = false
          throw Object.assign(new Error('stale'), { code: 'FS_STALE_VERSION' })
        }
        source = next
        writes += 1
        version += 1
        return String(version)
      },
    } satisfies WorkspaceFilePort,
    source: () => source,
    writes: () => writes,
    version: () => String(version),
    staleNextWrite: () => { staleNextWrite = true },
  }
}

describe('workspace controller', () => {
  it('loads, retains last-good structure on invalid source, and repairs', async () => {
    const file = memoryFile()
    const controller = new MindPptWorkspaceController(file.port)
    const identity = {
      sessionId: 's1',
      path: 'deck.mindppt',
    }
    await controller.select(identity)
    expect(controller.inspect('s1').structureCurrent).toBe(true)

    await controller.replaceSource(identity, INVALID, file.version())
    const invalid = controller.inspect('s1')
    expect(invalid.structureCurrent).toBe(false)
    expect(invalid.structureBasis).toBe('last-good')
    expect(invalid.semantic[0]?.id).toBe('root')
    expect(file.source()).toBe(INVALID)

    await controller.replaceSource(identity, VALID, file.version())
    expect(controller.inspect('s1').structureCurrent).toBe(true)
  })

  it('rejects stale expected text before write or compile', async () => {
    const file = memoryFile()
    const controller = new MindPptWorkspaceController(file.port)
    await controller.select({
      sessionId: 's1',
      path: 'deck.mindppt',
    })
    const writes = file.writes()
    const attempts = controller.attempts('s1')
    const result = await controller.guardedPatch('s1', {
      start: 0,
      end: 4,
      expected: 'nope',
      replacement: 'mind',
    })
    expect(result.ok).toBe(false)
    expect(file.writes()).toBe(writes)
    expect(controller.attempts('s1')).toBe(attempts)
  })

  it('rejects a concurrent workspace change before write or compile', async () => {
    const file = memoryFile()
    const controller = new MindPptWorkspaceController(file.port)
    await controller.select({
      sessionId: 's1',
      path: 'deck.mindppt',
    })
    const writes = file.writes()
    const attempts = controller.attempts('s1')
    file.staleNextWrite()
    const result = await controller.guardedPatch('s1', {
      start: 0,
      end: 7,
      expected: 'mindppt',
      replacement: 'mindppt',
    })
    expect(result).toEqual({
      ok: false,
      reason: 'stale patch: workspace file changed',
    })
    expect(file.writes()).toBe(writes)
    expect(controller.attempts('s1')).toBe(attempts)
  })

  it('rejects a stale human full-source write after an Agent mutation', async () => {
    const file = memoryFile()
    const controller = new MindPptWorkspaceController(file.port)
    const identity = {
      sessionId: 's1',
      path: 'deck.mindppt',
    }
    await controller.select(identity)
    const humanVersion = file.version()
    const root = VALID.indexOf('Root')
    const agentSource = VALID.replace('Root', 'Agent')

    const result = await controller.guardedPatch('s1', {
      start: root,
      end: root + 4,
      expected: 'Root',
      replacement: 'Agent',
    })
    expect(result.ok).toBe(true)
    expect(file.source()).toBe(agentSource)

    await expect(controller.replaceSource(
      identity,
      VALID.replace('Root', 'Human'),
      humanVersion,
    )).rejects.toMatchObject({ code: 'FS_STALE_VERSION' })

    expect(file.source()).toBe(agentSource)
    expect(controller.inspect('s1').source).toBe(agentSource)
  })

  it('keeps only the latest overlapping selection and clear cancels a pending one', async () => {
    const reads = new Map<
      string,
      ReturnType<typeof Promise.withResolvers<string>>
    >()
    const port: WorkspaceFilePort = {
      async readText(identity) {
        const read = reads.get(identity.path)
        if (!read) throw new Error('missing deferred read')
        return await read.promise
      },
      async readSnapshot() {
        throw new Error('not used')
      },
      async writeText() {
        throw new Error('not used')
      },
    }
    const controller = new MindPptWorkspaceController(port)
    const a = Promise.withResolvers<string>()
    const b = Promise.withResolvers<string>()
    reads.set('a.mindppt', a)
    reads.set('b.mindppt', b)

    const selectA = controller.select({ sessionId: 's1', path: 'a.mindppt' })
    const selectB = controller.select({ sessionId: 's1', path: 'b.mindppt' })
    b.resolve(VALID.replace('root', 'b'))
    await selectB
    expect(controller.inspect('s1').file.path).toBe('b.mindppt')

    a.resolve(VALID.replace('root', 'a'))
    await selectA
    expect(controller.inspect('s1').file.path).toBe('b.mindppt')

    const c = Promise.withResolvers<string>()
    reads.set('c.mindppt', c)
    const selectC = controller.select({ sessionId: 's1', path: 'c.mindppt' })
    controller.clear('s1', 'c.mindppt')
    c.resolve(VALID.replace('root', 'c'))
    await selectC
    expect(controller.inspect('s1').file.path).toBe('b.mindppt')
  })

  it('switches files and clears non-MindPPT selection', async () => {
    const file = memoryFile()
    const controller = new MindPptWorkspaceController(file.port)
    await controller.select({
      sessionId: 's1',
      path: 'a.mindppt',
    })
    await controller.select({
      sessionId: 's1',
      path: 'b.mindppt',
    })
    expect(controller.inspect('s1').file.path).toBe('b.mindppt')
    await controller.select({
      sessionId: 's1',
      path: 'readme.md',
    })
    expect(() => controller.inspect('s1')).toThrow()
  })
})
