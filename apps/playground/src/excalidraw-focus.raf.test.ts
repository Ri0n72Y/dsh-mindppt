import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CAMERA_TARGET_ZOOM_FACTOR,
  CAMERA_TRAVEL_DURATION,
  CAMERA_ZOOM_IN_DURATION,
  CAMERA_ZOOM_OUT_DURATION,
  CAMERA_ZOOM_OUT_FACTOR,
  runCameraTransition,
} from './excalidraw-focus.ts'

type SceneElement = ReturnType<
  ExcalidrawImperativeAPI['getSceneElements']
>[number]

function createRafHarness() {
  let nextId = 1
  const callbacks = new Map<number, (timestamp: number) => void>()

  const requestFrame = vi.fn((callback: (timestamp: number) => void) => {
    const id = nextId++
    callbacks.set(id, callback)
    return id
  })
  const cancelFrame = vi.fn((id: number) => {
    callbacks.delete(id)
  })

  vi.stubGlobal('requestAnimationFrame', requestFrame)
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)

  return {
    fire(timestamp: number) {
      const frameIds = [...callbacks.keys()]
      for (const id of frameIds) {
        const callback = callbacks.get(id)
        if (!callback) continue
        callbacks.delete(id)
        callback(timestamp)
      }
    },
    pendingCount: () => callbacks.size,
  }
}

function createRafClockApi(getElements: () => SceneElement[]) {
  let animationOwner: SceneElement | undefined
  let animationFrameId: number | undefined
  let animationRevision = 0
  const completedTargets: SceneElement[] = []
  const appState = {
    scrollX: 12,
    scrollY: -8,
    zoom: { value: 0.73 },
  }

  const cancelAnimation = () => {
    animationRevision += 1
    if (animationFrameId !== undefined) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = undefined
    }
    animationOwner = undefined
  }

  const scrollToContent = vi.fn((
    target: SceneElement,
    opts?: {
      animate?: boolean
      duration?: number
      fitToViewport?: boolean
      viewportZoomFactor?: number
    },
  ) => {
    cancelAnimation()
    if (!opts?.animate) return

    const revision = animationRevision
    const duration = opts.duration ?? 500
    let startTime: number | undefined
    animationOwner = target

    const step = (timestamp: number) => {
      if (revision !== animationRevision) return
      if (startTime === undefined) {
        startTime = timestamp
      }

      if (timestamp - startTime < duration) {
        animationFrameId = requestAnimationFrame(step)
        return
      }

      animationFrameId = undefined
      animationOwner = undefined
      completedTargets.push(target)
    }

    animationFrameId = requestAnimationFrame(step)
  })

  const updateScene = vi.fn()
  const api = {
    getSceneElements: getElements,
    getAppState: vi.fn(() => appState),
    scrollToContent,
    updateScene,
  } as unknown as ExcalidrawImperativeAPI

  return {
    api,
    scrollToContent,
    updateScene,
    getAnimationOwner: () => animationOwner,
    getCompletedTargets: () => [...completedTargets],
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('runCameraTransition RAF-aware phase completion', () => {
  it('keeps final framing active when the first Excalidraw RAF is delayed past the old wall-clock duration', async () => {
    const clock = createRafHarness()
    const targetV1 = { id: 'slide:intro/surface', version: 1 } as unknown as SceneElement
    const targetV2 = { id: 'slide:intro/surface', version: 2 } as unknown as SceneElement
    let target = targetV1
    const { api, scrollToContent } = createRafClockApi(() => [target])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'intro',
      fromSlideId: 'intro',
    })

    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)

    target = targetV2
    transition.reconcileScene()

    expect(scrollToContent).toHaveBeenCalledTimes(2)
    expect(scrollToContent).toHaveBeenLastCalledWith(targetV2, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    expect(clock.pendingCount()).toBe(2)

    transition.cancel()
  })

  it('can still interrupt the Excalidraw RAF in the historical premature-done window', async () => {
    const clock = createRafHarness()
    const target = { id: 'slide:intro/surface' } as SceneElement
    const {
      api,
      scrollToContent,
      getAnimationOwner,
      getCompletedTargets,
    } = createRafClockApi(() => [target])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'intro',
      fromSlideId: 'intro',
    })

    clock.fire(16)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)

    expect(getAnimationOwner()).toBe(target)
    transition.cancel()

    expect(scrollToContent).toHaveBeenLastCalledWith(target, { animate: false })
    expect(getAnimationOwner()).toBeUndefined()

    clock.fire(16 + CAMERA_ZOOM_IN_DURATION)
    expect(getCompletedTargets()).toEqual([])
  })

  it('interrupts terminal ownership when the focused target is removed in that window', async () => {
    const clock = createRafHarness()
    const target = { id: 'slide:intro/surface' } as SceneElement
    let includeTarget = true
    const {
      api,
      scrollToContent,
      getAnimationOwner,
      getCompletedTargets,
    } = createRafClockApi(() => includeTarget ? [target] : [])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'intro',
      fromSlideId: 'intro',
    })

    clock.fire(16)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)
    expect(getAnimationOwner()).toBe(target)

    includeTarget = false
    transition.cancel()

    expect(scrollToContent).toHaveBeenLastCalledWith(target, { animate: false })
    expect(getAnimationOwner()).toBeUndefined()

    clock.fire(16 + CAMERA_ZOOM_IN_DURATION)
    expect(getCompletedTargets()).toEqual([])
  })

  it('reconciles latest target geometry after wall-clock duration but before the real final RAF', async () => {
    const clock = createRafHarness()
    const targetV1 = { id: 'slide:intro/surface', version: 1 } as unknown as SceneElement
    const targetV2 = { id: 'slide:intro/surface', version: 2 } as unknown as SceneElement
    let target = targetV1
    const {
      api,
      scrollToContent,
      getAnimationOwner,
      getCompletedTargets,
    } = createRafClockApi(() => [target])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'intro',
      fromSlideId: 'intro',
    })

    clock.fire(16)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)
    expect(getAnimationOwner()).toBe(targetV1)

    target = targetV2
    transition.reconcileScene()

    expect(scrollToContent).toHaveBeenCalledTimes(2)
    expect(scrollToContent).toHaveBeenLastCalledWith(targetV2, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    expect(getAnimationOwner()).toBe(targetV2)

    clock.fire(16 + CAMERA_ZOOM_IN_DURATION)
    expect(getCompletedTargets()).toEqual([])

    transition.cancel()
  })

  it('enters done only after first RAF, full duration, and the following RAF completion boundary', async () => {
    const clock = createRafHarness()
    const targetV1 = { id: 'slide:intro/surface', version: 1 } as unknown as SceneElement
    const targetV2 = { id: 'slide:intro/surface', version: 2 } as unknown as SceneElement
    let target = targetV1
    const {
      api,
      scrollToContent,
      getAnimationOwner,
      getCompletedTargets,
    } = createRafClockApi(() => [target])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'intro',
      fromSlideId: 'intro',
    })

    clock.fire(16)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)

    expect(getAnimationOwner()).toBe(targetV1)
    expect(getCompletedTargets()).toEqual([])

    clock.fire(16 + CAMERA_ZOOM_IN_DURATION)

    expect(getAnimationOwner()).toBeUndefined()
    expect(getCompletedTargets()).toEqual([targetV1])

    target = targetV2
    transition.reconcileScene()
    expect(scrollToContent).toHaveBeenCalledTimes(1)
  })

  it('still progresses zoom-out to travel to zoom-in without duplicate or skipped phases', async () => {
    const clock = createRafHarness()
    const source = { id: 'slide:intro/surface' } as SceneElement
    const target = { id: 'slide:market/surface' } as SceneElement
    const targetV2 = { id: 'slide:market/surface', version: 2 } as unknown as SceneElement
    let currentTarget = target
    const { api, scrollToContent } = createRafClockApi(() => [source, currentTarget])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    clock.fire(16)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_OUT_DURATION)
    clock.fire(16 + CAMERA_ZOOM_OUT_DURATION)

    clock.fire(252)
    await vi.advanceTimersByTimeAsync(CAMERA_TRAVEL_DURATION)
    clock.fire(252 + CAMERA_TRAVEL_DURATION)

    clock.fire(608)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)
    clock.fire(608 + CAMERA_ZOOM_IN_DURATION)

    const animatedCalls = scrollToContent.mock.calls.filter(([, opts]) => opts?.animate)
    expect(animatedCalls).toEqual([
      [source, {
        fitToViewport: true,
        viewportZoomFactor: CAMERA_ZOOM_OUT_FACTOR,
        animate: true,
        duration: CAMERA_ZOOM_OUT_DURATION,
      }],
      [target, {
        animate: true,
        duration: CAMERA_TRAVEL_DURATION,
      }],
      [target, {
        fitToViewport: true,
        viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
        animate: true,
        duration: CAMERA_ZOOM_IN_DURATION,
      }],
    ])

    currentTarget = targetV2
    transition.reconcileScene()
    expect(scrollToContent.mock.calls.filter(([, opts]) => opts?.animate)).toHaveLength(3)
  })

  it('cancels stale host completion RAFs across repeated terminal reconciliation', async () => {
    const clock = createRafHarness()
    const targetV1 = { id: 'slide:intro/surface', version: 1 } as unknown as SceneElement
    const targetV2 = { id: 'slide:intro/surface', version: 2 } as unknown as SceneElement
    const targetV3 = { id: 'slide:intro/surface', version: 3 } as unknown as SceneElement
    const targetV4 = { id: 'slide:intro/surface', version: 4 } as unknown as SceneElement
    let target = targetV1
    const { api, scrollToContent } = createRafClockApi(() => [target])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'intro',
      fromSlideId: 'intro',
    })

    clock.fire(16)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)

    target = targetV2
    transition.reconcileScene()
    clock.fire(236)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)

    target = targetV3
    transition.reconcileScene()
    clock.fire(456)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)

    target = targetV4
    transition.reconcileScene()

    const animatedTargets = scrollToContent.mock.calls
      .filter(([, opts]) => opts?.animate)
      .map(([surface]) => surface)

    expect(animatedTargets).toEqual([targetV1, targetV2, targetV3, targetV4])

    transition.cancel()
  })

  it('preserves latest-request-wins even when replacement happens at the old completion boundary', async () => {
    const clock = createRafHarness()
    const intro = { id: 'slide:intro/surface' } as SceneElement
    const market = { id: 'slide:market/surface' } as SceneElement
    const solution = { id: 'slide:solution/surface' } as SceneElement
    const { api, scrollToContent } = createRafClockApi(() => [intro, market, solution])

    const first = runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    clock.fire(16)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_OUT_DURATION)
    first.cancel()

    runCameraTransition(api, {
      revision: 3,
      slideId: 'solution',
      fromSlideId: 'market',
    })

    clock.fire(236)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_OUT_DURATION)
    clock.fire(456)

    clock.fire(472)
    await vi.advanceTimersByTimeAsync(CAMERA_TRAVEL_DURATION)
    clock.fire(812)

    clock.fire(828)
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_IN_DURATION)
    clock.fire(1048)

    const animatedCalls = scrollToContent.mock.calls.filter(([, opts]) => opts?.animate)
    expect(animatedCalls).toEqual([
      [intro, {
        fitToViewport: true,
        viewportZoomFactor: CAMERA_ZOOM_OUT_FACTOR,
        animate: true,
        duration: CAMERA_ZOOM_OUT_DURATION,
      }],
      [market, {
        fitToViewport: true,
        viewportZoomFactor: CAMERA_ZOOM_OUT_FACTOR,
        animate: true,
        duration: CAMERA_ZOOM_OUT_DURATION,
      }],
      [solution, {
        animate: true,
        duration: CAMERA_TRAVEL_DURATION,
      }],
      [solution, {
        fitToViewport: true,
        viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
        animate: true,
        duration: CAMERA_ZOOM_IN_DURATION,
      }],
    ])
    expect(animatedCalls).not.toContainEqual([
      market,
      { animate: true, duration: CAMERA_TRAVEL_DURATION },
    ])
  })
})
