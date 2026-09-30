import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  const scrollToContent = vi.fn()
  const api = {
    getSceneElements: getElements,
    scrollToContent,
  } as unknown as ExcalidrawImperativeAPI

  return { api, scrollToContent }
}

afterEach(() => {
  vi.useRealTimers()
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
    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_OUT_DURATION)

    expect(scrollToContent).toHaveBeenCalledTimes(2)
    expect(scrollToContent).toHaveBeenLastCalledWith(targetV2, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })

    target = targetV3
    await vi.advanceTimersByTimeAsync(CAMERA_TRAVEL_DURATION)

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

    await vi.advanceTimersByTimeAsync(CAMERA_TRAVEL_DURATION)

    expect(scrollToContent).toHaveBeenCalledTimes(2)
    expect(scrollToContent).toHaveBeenLastCalledWith(target, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })
  })

  it('uses only the final animated focus for repeated same-slide requests', () => {
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
    expect(vi.getTimerCount()).toBe(0)
  })

  it('lets the latest request cancel every pending phase from the previous transition', async () => {
    vi.useFakeTimers()

    const intro = { id: 'slide:intro/surface' } as SceneElement
    const market = { id: 'slide:market/surface' } as SceneElement
    const solution = { id: 'slide:solution/surface' } as SceneElement
    const { api, scrollToContent } = createApi(() => [intro, market, solution])

    const cancelFirst = runCameraTransition(api, {
      revision: 2,
      slideId: 'market',
      fromSlideId: 'intro',
    })

    expect(scrollToContent).toHaveBeenCalledTimes(1)
    cancelFirst()

    runCameraTransition(api, {
      revision: 3,
      slideId: 'solution',
      fromSlideId: 'market',
    })

    expect(scrollToContent).toHaveBeenCalledTimes(2)
    expect(scrollToContent).toHaveBeenLastCalledWith(market, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_ZOOM_OUT_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_OUT_DURATION,
    })

    await vi.advanceTimersByTimeAsync(CAMERA_ZOOM_OUT_DURATION)
    expect(scrollToContent).toHaveBeenCalledTimes(3)
    expect(scrollToContent).toHaveBeenLastCalledWith(solution, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })

    await vi.advanceTimersByTimeAsync(CAMERA_TRAVEL_DURATION)
    expect(scrollToContent).toHaveBeenCalledTimes(4)
    expect(scrollToContent).toHaveBeenLastCalledWith(solution, {
      fitToViewport: true,
      viewportZoomFactor: CAMERA_TARGET_ZOOM_FACTOR,
      animate: true,
      duration: CAMERA_ZOOM_IN_DURATION,
    })

    expect(scrollToContent).not.toHaveBeenCalledWith(market, {
      animate: true,
      duration: CAMERA_TRAVEL_DURATION,
    })
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

    await vi.advanceTimersByTimeAsync(CAMERA_TRAVEL_DURATION)

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
