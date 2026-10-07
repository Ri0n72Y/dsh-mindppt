import { describe, expect, it, vi } from 'vitest'
import { FontMetricRefreshBinding } from '../src/client/font-metrics.ts'
import { BrowserMindPptRuntime } from '../src/client/runtime.ts'
import { fitWholeScene } from '../src/client/panorama-fit.ts'

describe('MindPPT canvas refresh behavior', () => {
  it('keeps the runtime receiver across font-ready refresh publication', async () => {
    const runtime = await BrowserMindPptRuntime.create(
      'mindppt\n\nslide root {\n  # Root\n}\n',
    )
    const published = vi.fn()
    const unsubscribe = runtime.subscribe(published)
    const detached = runtime.refreshElements
    expect(() => detached()).not.toThrow()
    expect(published).toHaveBeenCalledTimes(1)
    published.mockClear()

    const ready = Promise.withResolvers<FontFaceSet>()
    let loadingDone: (() => void) | undefined
    const add = vi.fn((_type: string, listener: () => void) => { loadingDone = listener })
    const remove = vi.fn()
    const fonts = {
      ready: ready.promise, addEventListener: add, removeEventListener: remove,
    } as unknown as FontFaceSet
    const binding = new FontMetricRefreshBinding()
    binding.update(runtime.refreshElements)
    const dispose = binding.attach(fonts)
    binding.update(runtime.refreshElements)

    ready.resolve(fonts)
    await ready.promise
    await Promise.resolve()
    expect(published).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledTimes(1)

    loadingDone?.()
    expect(published).toHaveBeenCalledTimes(2)
    expect(add).toHaveBeenCalledTimes(1)

    dispose()
    loadingDone?.()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(published).toHaveBeenCalledTimes(2)
    unsubscribe()
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
