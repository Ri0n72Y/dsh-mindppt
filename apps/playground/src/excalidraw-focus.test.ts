import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { describe, expect, it, vi } from 'vitest'

import { focusSlideSurface } from './excalidraw-focus.ts'

type SceneElement = ReturnType<
  ExcalidrawImperativeAPI['getSceneElements']
>[number]

describe('focusSlideSurface', () => {
  it('passes the real surface element through the non-string scrollToContent path', () => {
    const other = { id: 'slide:other/surface' } as SceneElement
    const surface = { id: 'slide:intro/surface' } as SceneElement
    const scrollToContent = vi.fn()
    const api = {
      getSceneElements: () => [other, surface],
      scrollToContent,
    } as unknown as ExcalidrawImperativeAPI

    expect(focusSlideSurface(api, 'intro')).toBe(true)
    expect(scrollToContent).toHaveBeenCalledTimes(1)
    expect(scrollToContent).toHaveBeenCalledWith(surface, {
      fitToViewport: true,
      viewportZoomFactor: 0.85,
      animate: false,
    })
    expect(typeof scrollToContent.mock.calls[0]?.[0]).not.toBe('string')
  })

  it('leaves the viewport unchanged when the requested surface is missing', () => {
    const scrollToContent = vi.fn()
    const api = {
      getSceneElements: () => [],
      scrollToContent,
    } as unknown as ExcalidrawImperativeAPI

    expect(focusSlideSurface(api, 'missing')).toBe(false)
    expect(scrollToContent).not.toHaveBeenCalled()
  })
})
