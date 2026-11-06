import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  runCameraTransition,
  CAMERA_TARGET_ZOOM_FACTOR,
} from '../src/presentation.ts'

function cameraHarness() {
  const surfaces = [
    { id: 'slide:a/surface', x: 0, y: 0, width: 1280, height: 720 },
    { id: 'slide:b/surface', x: 4000, y: 0, width: 1280, height: 720 },
    { id: 'slide:c/surface', x: 8000, y: 0, width: 1280, height: 720 },
  ]
  // Physical viewport begins far from the previously focused slide a.
  const state = {
    width: 1600, height: 900, scrollX: -1550, scrollY: -135,
    zoom: { value: 2 },
  }
  const api = {
    getSceneElements: () => surfaces,
    getAppState: () => state,
    updateScene: vi.fn(({ appState }: { appState: Partial<typeof state> }) => {
      Object.assign(state, appState)
    }),
    scrollToContent: vi.fn(),
  } as unknown as ExcalidrawImperativeAPI
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    const id = ++nextId
    callbacks.set(id, fn)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    callbacks.delete(id)
  })
  const step = (time: number) => {
    const pending = [...callbacks.values()]
    callbacks.clear()
    for (const callback of pending) callback(time)
  }
  const center = () => ({
    x: state.width / (2 * state.zoom.value) - state.scrollX,
    y: state.height / (2 * state.zoom.value) - state.scrollY,
  })
  return { api, surfaces, state, center, step, callbacks }
}

afterEach(() => vi.unstubAllGlobals())

describe('Camera continuous viewport transition', () => {
  it('keeps the physical starting view and one continuous fly-out path to the target', () => {
    const h = cameraHarness()
    const initial = h.center()
    expect(initial.x).toBe(1950)
    const controller = runCameraTransition(h.api, {
      revision: 1, fromSlideId: 'a', slideId: 'b',
    })

    expect(h.center()).toEqual(initial)
    h.step(0)
    expect(h.center()).toEqual(initial)
    h.step(390)
    expect(h.center().x).toBeGreaterThan(initial.x)
    expect(h.center().x).toBeLessThan(4640)
    expect(h.state.zoom.value).toBeLessThan(1)
    h.step(780)
    expect(h.center().x).toBeCloseTo(4640)
    expect(h.center().y).toBeCloseTo(360)
    expect(h.state.zoom.value).toBeCloseTo(1)
    expect(CAMERA_TARGET_ZOOM_FACTOR).toBe(0.85)
    expect(h.callbacks.size).toBe(0)
    expect(h.api.scrollToContent).not.toHaveBeenCalled()
    controller.cancel()
  })

  it('redirects rapid focus from the interpolated viewport without a re-anchor', () => {
    const h = cameraHarness()
    const first = runCameraTransition(h.api, {
      revision: 1, fromSlideId: 'a', slideId: 'b',
    })
    h.step(0)
    h.step(300)
    const interrupted = h.center()
    const interruptedZoom = h.state.zoom.value
    first.cancel()

    const second = runCameraTransition(h.api, {
      revision: 2, fromSlideId: 'b', slideId: 'c',
    })
    h.step(320)
    expect(h.center().x).toBeCloseTo(interrupted.x)
    expect(h.state.zoom.value).toBeCloseTo(interruptedZoom)
    h.step(1100)
    expect(h.center().x).toBeCloseTo(8640)
    expect(h.center().y).toBeCloseTo(360)
    expect(h.callbacks.size).toBe(0)
    second.cancel()
  })

  it('retargets after a layout update and stops safely if a slide disappears', () => {
    const h = cameraHarness()
    const controller = runCameraTransition(h.api, {
      revision: 1, fromSlideId: 'a', slideId: 'b',
    })
    h.step(0)
    h.step(390)
    const before = h.center().x
    h.surfaces[1]!.x = 6000
    controller.reconcileScene()
    expect(h.center().x).toBeCloseTo(before)
    h.step(400)
    expect(h.center().x).toBeCloseTo(before)
    h.step(790)
    expect(h.center().x).toBeCloseTo(6640)

    const other = runCameraTransition(h.api, {
      revision: 2, fromSlideId: 'b', slideId: 'c',
    })
    h.step(800)
    h.step(980)
    const frozen = h.center()
    h.surfaces.pop()
    other.reconcileScene()
    h.step(1600)
    expect(h.center()).toEqual(frozen)
    expect(h.callbacks.size).toBe(0)
  })
})
