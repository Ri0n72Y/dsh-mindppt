import { describe, expect, it, vi } from 'vitest'

vi.mock('@excalidraw/excalidraw', () => ({
  convertToExcalidrawElements: (elements: unknown) => elements,
}))

import { createPlaygroundRuntime } from './runtime.ts'

const SOURCE = [
  'mindppt',
  '',
  'tree LR {',
  '  hero --> problem',
  '  problem --> summary',
  '}',
  '',
  'slide hero {',
  '  # M9',
  '}',
  '',
  'slide problem {',
  '  # Euler identity',
  '',
  '  ```latex',
  '  e^{i\\pi} + 1 = 0',
  '  ```',
  '}',
  '',
  'path short {',
  '  hero',
  '  problem',
  '  summary',
  '}',
  '',
  'slide summary {',
  '  # Summary',
  '}',
  '',
].join('\n')

describe('M9 playground renderer lifecycle', () => {
  it('preserves source and Camera state while LaTeX capability toggles', async () => {
    const runtime = await createPlaygroundRuntime(SOURCE)
    runtime.selectPath('path:short')
    runtime.pathNext()

    const before = runtime.getSnapshot()
    const fallbackId = 'slide:problem/extension:0/box'

    expect(before.camera.currentSlideId).toBe('problem')
    expect(before.camera.selectedPathId).toBe('path:short')
    expect(before.camera.currentPathOccurrenceIndex).toBe(1)
    expect(before.extensionRendererTypes).toEqual([])
    expect(before.elements.some(({ id }) => id === fallbackId)).toBe(true)

    await runtime.enableLatex()
    const enabled = runtime.getSnapshot()

    expect(enabled.source).toBe(before.source)
    expect(enabled.diagnostics).toBe(before.diagnostics)
    expect(enabled.files).toBe(before.files)
    expect(enabled.camera).toBe(before.camera)
    expect(enabled.extensionRendererTypes).toEqual(['latex'])
    expect(enabled.elements.some(({ id }) => id === fallbackId)).toBe(false)
    expect(enabled.elements.some(
      ({ id }) => id === 'slide:problem/extension:0/latex/superscript',
    )).toBe(true)

    await runtime.disableLatex()
    const disabled = runtime.getSnapshot()

    expect(disabled.source).toBe(before.source)
    expect(disabled.camera).toBe(before.camera)
    expect(disabled.extensionRendererTypes).toEqual([])
    expect(disabled.elements.some(({ id }) => id === fallbackId)).toBe(true)

    await runtime.enableLatex()
    expect(runtime.getSnapshot().extensionRendererTypes).toEqual(['latex'])
    expect(runtime.getSnapshot().camera).toBe(before.camera)
  })
})
