import { readFileSync } from 'node:fs'

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCameraService, { serviceName } from '../src/index.ts'

const M4 = readFileSync(
  new URL('../../../examples/m4-branching-lr-tree.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

async function createRuntime() {
  const ctx = new Context()
  await ctx.plugin(MindPptParserService)
  await ctx.plugin(MindPptCameraService)

  let parser: MindPptParserService | undefined
  let camera: MindPptCameraService | undefined

  await ctx.plugin({
    name: 'mindppt-camera-test-driver',
    inject: ['mindpptParser', serviceName],
    apply(child: Context) {
      parser = child.mindpptParser
      camera = child.mindpptCamera
    },
  })

  if (!parser || !camera) throw new Error('Camera test runtime did not initialize')

  parser.compile(M4)
  return { parser, camera }
}

describe('MindPptCameraService', () => {
  it('directly focuses an existing slide and exposes its geometry', async () => {
    const { camera } = await createRuntime()

    expect(camera.focusSlide('intro')).toBe(true)
    expect(camera.currentSlideId).toBe('intro')
    expect(camera.view.target).toEqual(expect.objectContaining({
      slideId: 'intro',
      width: 1280,
      height: 720,
    }))
  })

  it('navigates from a parent to one of its primary-tree children', async () => {
    const { camera } = await createRuntime()

    camera.focusSlide('intro')
    expect(camera.focusChild('market')).toBe(true)
    expect(camera.currentSlideId).toBe('market')
  })

  it('navigates from a child back to its primary-tree parent', async () => {
    const { camera } = await createRuntime()

    camera.focusSlide('market')
    expect(camera.focusParent()).toBe(true)
    expect(camera.currentSlideId).toBe('intro')
  })

  it('preserves primary-tree child source order for branching navigation', async () => {
    const { camera } = await createRuntime()

    camera.focusSlide('market')
    expect(camera.view.childSlideIds).toEqual(['customer', 'competitor'])
    expect(camera.view.parentSlideId).toBe('intro')
  })

  it('keeps state unchanged for an invalid direct target', async () => {
    const { camera } = await createRuntime()

    camera.focusSlide('intro')
    const before = camera.view

    expect(camera.focusSlide('missing')).toBe(false)
    expect(camera.view.currentSlideId).toBe('intro')
    expect(camera.view.focusRequest).toEqual(before.focusRequest)
  })

  it('keeps current navigation state across compile failure', async () => {
    const { parser, camera } = await createRuntime()

    camera.focusSlide('market')
    const before = camera.view

    expect(() => parser.compile(M4.slice(0, -2))).toThrow()
    expect(camera.view.currentSlideId).toBe('market')
    expect(camera.view.focusRequest).toEqual(before.focusRequest)
  })

  it('clears current state when a successful compile removes that slide', async () => {
    const { parser, camera } = await createRuntime()

    camera.focusSlide('market')
    parser.compile(`mindppt

slide intro {
  # Introduction
}
`)

    expect(camera.currentSlideId).toBeUndefined()
    expect(camera.view.target).toBeUndefined()
    expect(camera.view.focusRequest).toBeUndefined()
  })

  it('allows direct focus of a successfully compiled unreachable slide', async () => {
    const { parser, camera } = await createRuntime()
    const withOrphan = `${M4}
slide orphan {
  # Orphan
}
`

    parser.compile(withOrphan)

    expect(parser.diagnostics[0]?.severity).toBe('warning')
    expect(camera.focusSlide('orphan')).toBe(true)
    expect(camera.currentSlideId).toBe('orphan')
    expect(camera.view.parentSlideId).toBeUndefined()
    expect(camera.view.childSlideIds).toEqual([])
  })

  it('issues a new request revision when the same slide is focused again', async () => {
    const { camera } = await createRuntime()

    camera.focusSlide('intro')
    const firstRevision = camera.view.focusRequest?.revision
    camera.focusSlide('intro')

    expect(camera.view.focusRequest?.revision).toBe((firstRevision ?? 0) + 1)
  })
})
