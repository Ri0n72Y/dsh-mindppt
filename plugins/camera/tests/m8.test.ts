import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCameraService from '../src/index.ts'

const M8 = readFileSync(
  new URL(
    '../../../examples/m8-soft-links-presentation-paths.mindppt',
    import.meta.url,
  ),
  'utf8',
).replace(/\r\n/g, '\n')

async function createRuntime(source = M8) {
  const ctx = new Context()
  await ctx.plugin(MindPptParserService)
  await ctx.plugin(MindPptCameraService)
  let parser: MindPptParserService | undefined
  let camera: MindPptCameraService | undefined

  await ctx.plugin({
    name: 'mindppt-m8-camera-test-driver',
    inject: ['mindpptParser', 'mindpptCamera'],
    apply(child: Context) {
      parser = child.mindpptParser
      camera = child.mindpptCamera
    },
  })

  if (!parser || !camera) throw new Error('Camera test runtime did not initialize')
  parser.compile(source)
  return { parser, camera }
}

describe('M8 Camera nonlinear navigation', () => {
  it('selects, advances, reverses, switches, and respects boundaries', async () => {
    const { camera } = await createRuntime()

    expect(camera.selectPath('path:main')).toBe(true)
    expect(camera.view).toEqual(expect.objectContaining({
      currentSlideId: 'hero',
      selectedPathId: 'path:main',
      currentPathOccurrenceIndex: 0,
      currentPathOccurrenceCount: 6,
      canPathPrevious: false,
      canPathNext: true,
    }))

    expect(camera.pathPrevious()).toBe(false)
    expect(camera.pathNext()).toBe(true)
    expect(camera.view.currentSlideId).toBe('agenda')
    expect(camera.view.currentPathOccurrenceIndex).toBe(1)
    expect(camera.pathPrevious()).toBe(true)
    expect(camera.view.currentSlideId).toBe('hero')

    expect(camera.selectPath('path:short')).toBe(true)
    expect(camera.pathNext()).toBe(true)
    expect(camera.view.currentSlideId).toBe('problem')
    expect(camera.pathNext()).toBe(true)
    expect(camera.view.currentSlideId).toBe('summary')
    expect(camera.view.canPathNext).toBe(false)
    expect(camera.pathNext()).toBe(false)
  })

  it('uses occurrence index for repeated and consecutive same-slide steps', async () => {
    const { camera } = await createRuntime()
    camera.selectPath('path:main')
    camera.pathNext()
    camera.pathNext()
    expect(camera.view.currentSlideId).toBe('customer')
    expect(camera.view.currentPathOccurrenceIndex).toBe(2)

    camera.pathNext()
    camera.pathNext()
    expect(camera.view.currentSlideId).toBe('customer')
    expect(camera.view.currentPathOccurrenceIndex).toBe(4)

    const repeated = `mindppt

tree LR {
  a --> b
}

slide a {
  # A
}

slide b {
  # B
}

path repeat {
  a
  a
  b
}
`
    const second = await createRuntime(repeated)
    second.camera.selectPath('path:repeat')
    const revision = second.camera.view.focusRequest?.revision
    expect(second.camera.pathNext()).toBe(true)
    expect(second.camera.view.currentPathOccurrenceIndex).toBe(1)
    expect(second.camera.view.focusRequest).toEqual({
      revision: (revision ?? 0) + 1,
      slideId: 'a',
      fromSlideId: 'a',
    })
  })

  it('exits path context on direct, tree, and declared SoftLink navigation', async () => {
    const { camera } = await createRuntime()

    camera.selectPath('path:main')
    expect(camera.focusChild('agenda')).toBe(true)
    expect(camera.view.selectedPathId).toBeUndefined()

    camera.selectPath('path:main')
    camera.pathNext()
    expect(camera.focusParent()).toBe(true)
    expect(camera.view.currentSlideId).toBe('hero')
    expect(camera.view.selectedPathId).toBeUndefined()

    camera.selectPath('path:main')
    expect(camera.focusSlide('analysis')).toBe(true)
    expect(camera.view.selectedPathId).toBeUndefined()

    camera.selectPath('path:main')
    camera.pathNext()
    camera.pathNext()
    expect(camera.view.outgoingSoftLinks).toEqual([{
      id: 'link:customer->summary',
      targetSlideId: 'summary',
    }])
    expect(camera.followSoftLink('link:customer->summary')).toBe(true)
    expect(camera.view.currentSlideId).toBe('summary')
    expect(camera.view.selectedPathId).toBeUndefined()
  })

  it('rejects undeclared SoftLink follow without changing state', async () => {
    const { camera } = await createRuntime()
    camera.focusSlide('customer')
    const before = camera.view

    expect(camera.followSoftLink('link:customer->analysis')).toBe(false)
    expect(camera.view).toEqual(before)
  })

  it('preserves exact valid path state and clears only stale route context', async () => {
    const { parser, camera } = await createRuntime()
    camera.selectPath('path:main')
    camera.pathNext()
    camera.pathNext()
    const request = camera.view.focusRequest

    parser.compile(M8.replace(
      'Outdoor teams need a fast way to explain the product story.',
      'Outdoor teams need a clear way to explain the product story.',
    ))
    expect(camera.view.currentSlideId).toBe('customer')
    expect(camera.view.selectedPathId).toBe('path:main')
    expect(camera.view.currentPathOccurrenceIndex).toBe(2)
    expect(camera.view.focusRequest).toEqual(request)

    parser.compile(M8.replace(
      'path main {\n  hero\n  agenda\n  customer\n',
      'path main {\n  hero\n  agenda\n  analysis\n',
    ))
    expect(camera.view.currentSlideId).toBe('customer')
    expect(camera.view.selectedPathId).toBeUndefined()
  })

  it('keeps current slide and path state untouched on compile failure', async () => {
    const { parser, camera } = await createRuntime()
    camera.selectPath('path:main')
    camera.pathNext()
    camera.pathNext()
    const before = camera.view

    expect(() => parser.compile(M8.replace(
      'link customer -.-> summary',
      'link customer -.-> customer',
    ))).toThrow()

    expect(camera.view).toEqual(before)
  })
})
