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
  return {
    port: {
      async readText() { return source },
      async writeText(_path: string, next: string) {
        source = next
        writes += 1
      },
    },
    source: () => source,
    writes: () => writes,
  }
}

describe('workspace controller', () => {
  it('loads, retains last-good structure on invalid source, and repairs', async () => {
    const file = memoryFile()
    const controller = new MindPptWorkspaceController(file.port)
    const identity = {
      sessionId: 's1',
      path: 'deck.mindppt',
      absolutePath: '/w/deck.mindppt',
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

  it('rejects stale patches before write or compile', async () => {
    const file = memoryFile()
    const controller = new MindPptWorkspaceController(file.port)
    await controller.select({
      sessionId: 's1',
      path: 'deck.mindppt',
      absolutePath: '/w/deck.mindppt',
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

  it('switches files and clears non-MindPPT selection', async () => {
    const file = memoryFile()
    const controller = new MindPptWorkspaceController(file.port)
    await controller.select({
      sessionId: 's1',
      path: 'a.mindppt',
      absolutePath: '/w/a.mindppt',
    })
    await controller.select({
      sessionId: 's1',
      path: 'b.mindppt',
      absolutePath: '/w/b.mindppt',
    })
    expect(controller.inspect('s1').file.path).toBe('b.mindppt')
    await controller.select({
      sessionId: 's1',
      path: 'readme.md',
      absolutePath: '/w/readme.md',
    })
    expect(() => controller.inspect('s1')).toThrow()
  })
})
