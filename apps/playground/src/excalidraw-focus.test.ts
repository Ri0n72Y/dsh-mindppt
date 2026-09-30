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

function createApi(getElements: () => SceneElement[]) {
  let animationOwner: SceneElement | undefined
  const appState = {
    scrollX: 12,
    scrollY: -8,
    zoom: { value: 0.73 },
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
    animationOwner = opts?.animate ? target : undefined
  })
  const updateScene = vi.fn()
  const getAppState = vi.fn(() => appState)
  const api = {
    getSceneElements: getElements,
    getAppState,
    scrollToContent,
    updateScene,
  } as unknown as ExcalidrawImperativeAPI

  return {
    api,
    scrollToContent,
    updateScene,
    getAppState,
    getAnimationOwner: () => animationOwner,
    appState,
  }
}

let animationFrameCallbacks = new Map<number, (timestamp: number) => void>()
let nextAnimationFrame = 1

function fireAnimationFrame(timestamp: number) {
  const frameIds = [...animationFrameCallbacks.keys()]
  for (const id of frameIds) {
    const callback = animationFrameCallbacks.get(id)
    if (!callback) continue
    animationFrameCallbacks.delete(id)
    callback(timestamp)
  }
}

async function completeAnimationWindow(duration: number) {
  fireAnimationFrame(0)
  await vi.advanceTimersByTimeAsync(duration)
  fireAnimationFrame(duration)
}

beforeEach(() => {
  animationFrameCallbacks = new Map()
  nextAnimationFrame = 1

  vi.stubGlobal(
    'requestAnimationFrame',
    (callback: (timestamp: number) => void) => {
      const handle = nextAnimationFrame++
      animationFrameCallbacks.set(handle, callback)
      return handle
    },
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    (handle: number) => {
      animationFrameCallbacks.delete(handle)
    },
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('runCameraTransition', () => {
  it('runs zoom-out, travel, and zoom-in while resolving the current scene for each phase', async () => {
    vi.useFakeTimers()

    const source = { id: 'slide:intro/surface' } as SceneElement
    const targetV1 = { id: 'slide:market/surface', version: 1 } as unknown as SceneElement
    const targetV2 = { id: 'slide:market/surface', version: 2 } as unknown as SceneElement
    const targetV3 = { id: 'slide:market/surface', version: 3 } as unknown as SceneElement
    let target = targetV1
    const { api, scrollToContent } = createApi(() => [source, target])

    runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    expect(scrollToContent).toHaveBeenCalledTimes(1)
    expect(scrollToContent).toHaveBeenLastCalledWith(source, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_ZOOM_OUT_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_OUT_DURATION,
    })

    target = targetV2
    await completeAnimationWindow(CAMERA_ZOOM_OUT_DURATION)

    expect(scrollToContent).toHaveBeenCalledTimes(2)
    expect(scrollToContent).toHaveBeenLastCalledWith(targetV2, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })

    target = targetV3
    await completeAnimationWindow(CAMERA_TRAVEL_DURATION)

    expect(scrollToContent).toHaveBeenCalledTimes(3)
    expect(scrollToContent).toHaveBeenLastCalledWith(targetV3, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    expect(typeof scrollToContent.mock.calls[0]?.[0]).not.toBe('string')
  })

  it('travels from the overview zoom before applying the final target framing', async () => {
    vi.useFakeTimers()

    const target = { id: 'slide:intro/surface' } as SceneElement
    const { api, scrollToContent } = createApi(() => [target])

    runCameraTransition(api, {
      revision: 1,
      slideId: 'intro',
    })

    expect(scrollToContent).toHaveBeenCalledTimes(1)
    expect(scrollToContent).toHaveBeenLastCalledWith(target, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })

    await completeAnimationWindow(CAMERA_TRAVEL_DURATION)

    expect(scrollToContent).toHaveBeenCalledTimes(2)
    expect(scrollToContent).toHaveBeenLastCalledWith(target, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
  })

  it('uses only the final animated focus for repeated same-slide requests', async () => {
    vi.useFakeTimers()

    const target = { id: 'slide:intro/surface' } as SceneElement
    const { api, scrollToContent } = createApi(() => [target])

    runCameraTransition(api, {
      revision: 2,
      slideId: 'intro',
      fromSlideId: 'intro',
    })

    expect(scrollToContent).toHaveBeenCalledTimes(1)
    expect(scrollToContent).toHaveBeenCalledWith(target, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    await completeAnimationWindow(CAMERA_ZOOM_IN_DURATION)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels active Excalidraw viewport ownership as well as pending host phases', async () => {
    vi.useFakeTimers()

    const source = { id: 'slide:intro/surface' } as SceneElement
    const target = { id: 'slide:market/surface' } as SceneElement
    const {
      api,
      scrollToContent,
      updateScene,
      getAnimationOwner,
      appState,
    } = createApi(() => [source, target])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    expect(getAnimationOwner()).toBe(source)
    transition.cancel()

    expect(scrollToContent).toHaveBeenLastCalledWith(source, { animate: false })
    expect(updateScene).toHaveBeenLastCalledWith({
      appState: {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
      },
    })
    expect(getAnimationOwner()).toBeUndefined()

    await vi.runAllTimersAsync()
    expect(scrollToContent).toHaveBeenCalledTimes(2)
  })

  it('stops an active final animation when its request is removed without a successor', async () => {
    vi.useFakeTimers()

    const source = { id: 'slide:intro/surface' } as SceneElement
    const target = { id: 'slide:market/surface' } as SceneElement
    const { api, scrollToContent, getAnimationOwner } = createApi(() => [source, target])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    await completeAnimationWindow(CAMERA_ZOOM_OUT_DURATION)
    await completeAnimationWindow(CAMERA_TRAVEL_DURATION)
    expect(getAnimationOwner()).toBe(target)

    transition.cancel()

    expect(scrollToContent).toHaveBeenLastCalledWith(target, { animate: false })
    expect(getAnimationOwner()).toBeUndefined()

    await vi.runAllTimersAsync()
    expect(scrollToContent).toHaveBeenCalledTimes(4)
  })

  it('reconciles only the active terminal framing against latest scene geometry', async () => {
    vi.useFakeTimers()

    const source = { id: 'slide:intro/surface' } as SceneElement
    const targetV1 = { id: 'slide:market/surface', version: 1 } as unknown as SceneElement
    const targetV2 = { id: 'slide:market/surface', version: 2 } as unknown as SceneElement
    let target = targetV1
    const { api, scrollToContent } = createApi(() => [source, target])

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    await completeAnimationWindow(CAMERA_ZOOM_OUT_DURATION)
    await completeAnimationWindow(CAMERA_TRAVEL_DURATION)
    expect(scrollToContent).toHaveBeenCalledTimes(3)
    expect(scrollToContent).toHaveBeenLastCalledWith(targetV1, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })

    target = targetV2
    transition.reconcileScene()

    expect(scrollToContent).toHaveBeenCalledTimes(4)
    expect(scrollToContent).toHaveBeenLastCalledWith(targetV2, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
    expect(scrollToContent.mock.calls.filter(([, opts]) =>
      opts?.viewportZoomFactor === CAMERA_ZOOM_OUT_FACTOR,
    )).toHaveLength(1)
    expect(scrollToContent.mock.calls.filter(([, opts]) =>
      opts?.duration === CAMERA_TRAVEL_DURATION,
    )).toHaveLength(1)

    await completeAnimationWindow(CAMERA_ZOOM_IN_DURATION)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not refocus after the transition is done', async () => {
    vi.useFakeTimers()

    const targetV1 = { id: 'slide:intro/surface', version: 1 } as unknown as SceneElement
    const targetV2 = { id: 'slide:intro/surface', version: 2 } as unknown as SceneElement
    let target = targetV1
    const { api, scrollToContent } = createApi(() => [target])

    const transition = runCameraTransition(api, {
      revision: 1,
      slideId: 'intro',
    })

    await completeAnimationWindow(CAMERA_TRAVEL_DURATION)
    await completeAnimationWindow(CAMERA_ZOOM_IN_DURATION)
    expect(scrollToContent).toHaveBeenCalledTimes(2)

    target = targetV2
    transition.reconcileScene()

    expect(scrollToContent).toHaveBeenCalledTimes(2)
  })

  it('interrupts the terminal animation when the target disappears during reconciliation', async () => {
    vi.useFakeTimers()

    const source = { id: 'slide:intro/surface' } as SceneElement
    const target = { id: 'slide:market/surface' } as SceneElement
    let includeTarget = true
    const { api, scrollToContent, getAnimationOwner } = createApi(() =>
      includeTarget ? [source, target] : [source],
    )

    const transition = runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    await completeAnimationWindow(CAMERA_ZOOM_OUT_DURATION)
    await completeAnimationWindow(CAMERA_TRAVEL_DURATION)
    expect(getAnimationOwner()).toBe(target)

    includeTarget = false
    transition.reconcileScene()

    expect(scrollToContent).toHaveBeenLastCalledWith(target, { animate: false })
    expect(getAnimationOwner()).toBeUndefined()

    const callsAfterRemoval = scrollToContent.mock.calls.length
    await vi.runAllTimersAsync()
    expect(scrollToContent).toHaveBeenCalledTimes(callsAfterRemoval)
  })

  it('lets the latest request replace the previous transition without stale phases reclaiming the viewport', async () => {
    vi.useFakeTimers()

    const intro = { id: 'slide:intro/surface' } as SceneElement
    const market = { id: 'slide:market/surface' } as SceneElement
    const solution = { id: 'slide:solution/surface' } as SceneElement
    const { api, scrollToContent } = createApi(() => [intro, market, solution])

    const first = runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    first.cancel()

    runCameraTransition(api, {
      revision: 3,
      slideId: 'solution',
      fromSlideId: 'market',
    })

    await completeAnimationWindow(CAMERA_ZOOM_OUT_DURATION)
    await completeAnimationWindow(CAMERA_TRAVEL_DURATION)

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

  it('degrades to target travel and final focus when the source surface is missing', async () => {
    vi.useFakeTimers()

    const target = { id: 'slide:market/surface' } as SceneElement
    const { api, scrollToContent } = createApi(() => [target])

    runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    expect(scrollToContent).toHaveBeenCalledTimes(1)
    expect(scrollToContent).toHaveBeenLastCalledWith(target, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })

    await completeAnimationWindow(CAMERA_TRAVEL_DURATION)

    expect(scrollToContent).toHaveBeenCalledTimes(2)
    expect(scrollToContent).toHaveBeenLastCalledWith(target, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
  })

  it('stops safely when the target surface is missing', async () => {
    vi.useFakeTimers()

    const source = { id: 'slide:intro/surface' } as SceneElement
    const { api, scrollToContent } = createApi(() => [source])

    expect(() => runCameraTransition(api, {
      revision: 2,
      slideId: 'missing',
      fromSlideId: 'intro',
    })).not.toThrow()

    expect(scrollToContent).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(scrollToContent).not.toHaveBeenCalled()
  })
})
