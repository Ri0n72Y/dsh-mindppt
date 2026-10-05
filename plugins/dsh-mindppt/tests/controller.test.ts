import { describe, expect, it } from 'vitest'
import { MindPptWorkspaceController } from '../src/controller.ts'

const VALID = `mindppt
slide root
  # Root
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
        _signal?: AbortSignal,
        expectedVersion?: string,
      ) {
        if (staleNextWrite || (
          expectedVersion !== undefined
          && expectedVersion !== String(version)
        )) {
          staleNextWrite = false
          throw Object.assign(new Error('stale'), { code: 'FS_STALE_VERSION' })
        }
        source = next
        writes += 1
        version += 1
      },
    },
    source: () => source,
    writes: () => writes,
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

    await controller.replaceSource(identity, INVALID)
    const invalid = controller.inspect('s1')
    expect(invalid.structureCurrent).toBe(false)
    expect(invalid.structureBasis).toBe('last-good')
    expect(invalid.semantic[0]?.id).toBe('root')
    expect(file.source()).toBe(INVALID)

    await controller.replaceSource(identity, VALID)
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
