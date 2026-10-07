import { describe, expect, it, vi } from 'vitest'
import { FontMetricRefreshBinding } from '../src/client/font-metrics.ts'
import { fitWholeScene } from '../src/client/panorama-fit.ts'

describe('MindPPT canvas refresh behavior', () => {
  it('updates font refresh callback without another subscription', async () => {
    const ready = Promise.withResolvers<FontFaceSet>()
    let loadingDone: (() => void) | undefined
    const add = vi.fn((_type: string, listener: () => void) => { loadingDone = listener })
    const remove = vi.fn()
    const fonts = {
      ready: ready.promise, addEventListener: add, removeEventListener: remove,
    } as unknown as FontFaceSet
    const binding = new FontMetricRefreshBinding()
    const first = vi.fn()
    const latest = vi.fn()
    binding.update(first)
    const dispose = binding.attach(fonts)
    binding.update(latest)
    ready.resolve(fonts)
    await ready.promise
    await Promise.resolve()
    expect(add).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
    loadingDone?.()
    expect(add).toHaveBeenCalledTimes(1)
    expect(latest).toHaveBeenCalledTimes(2)
    dispose()
    loadingDone?.()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(latest).toHaveBeenCalledTimes(2)
  })

  it('fits complete panorama scene to viewport', () => {
    const refresh = vi.fn()
    const scrollToContent = vi.fn()
    const api = { refresh, scrollToContent } as never
    const elements = [{ id: 'a' }, { id: 'b' }] as never
    fitWholeScene(api, elements)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(scrollToContent).toHaveBeenCalledWith(elements, {
      fitToViewport: true,
      viewportZoomFactor: 0.9,
    })
  })
})
