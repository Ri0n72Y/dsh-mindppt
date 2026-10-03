import { expect, test } from '@playwright/test'

test('same-slide preset switching keeps camera and mounted state current', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')

  await page.evaluate(async () => {
    const { mountAssetBrowserHarness } = await import('/src/asset-browser-harness.tsx')
    const container = document.createElement('div')
    container.style.width = '1000px'
    container.style.height = '760px'
    document.body.append(container)

    const sources = {
      hero: `mindppt

slide switch {
  layout hero

  # Hero
  ## Stable camera
}
`,
      title: `mindppt

slide switch {
  layout title-content

  # Title content

  Ordinary body.
}
`,
      columns: `mindppt

slide switch {
  layout two-column

  # Two column

  left {
    Left body.
  }

  right {
    ![Fixture](./assets/b.svg)
  }
}
`,
    }
    const files = {
      'examples/assets/b.svg': {
        mimeType: 'image/svg+xml',
        dataURL: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"%3E%3Crect width="20" height="20" fill="%232563eb"/%3E%3C/svg%3E',
      },
    }
    const harness = await mountAssetBrowserHarness(
      container,
      sources.hero,
      { documentPath: 'examples/switch.mindppt', files },
    )
    harness.runtime.focusSlide('switch')
    ;(window as any).__m6Switch = { harness, sources }
  })

  await expect.poll(() => page.evaluate(() => {
    const state = (window as any).__m6Switch
    return Boolean(state.harness.getApi())
  })).toBe(true)
  await page.waitForTimeout(900)

  const before = await page.evaluate(() => {
    const state = (window as any).__m6Switch
    const appState = state.harness.getApi().getAppState()
    const camera = state.harness.runtime.getSnapshot().camera
    return {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom.value,
      revision: camera.focusRequest?.revision,
    }
  })

  await page.evaluate(() => {
    const state = (window as any).__m6Switch
    state.harness.runtime.setSource(state.sources.title)
    state.harness.runtime.setSource(state.sources.columns)
  })
  await expect.poll(() => page.evaluate(() => {
    const state = (window as any).__m6Switch
    return Object.keys(state.harness.getMountedFiles()).length
  })).toBe(1)

  await page.evaluate(() => {
    const state = (window as any).__m6Switch
    state.harness.runtime.setSource(state.sources.hero)
  })

  await expect.poll(() => page.evaluate(() => {
    const state = (window as any).__m6Switch
    const api = state.harness.getApi()
    const ids = api.getSceneElements().map((element: any) => element.id)
    return (
      Object.keys(state.harness.getMountedFiles()).length === 0
      && ids.includes('slide:switch/subtitle:0/box')
      && !ids.includes('slide:switch/left/text:0/box')
      && !ids.includes('slide:switch/right/image:0')
    )
  })).toBe(true)

  const after = await page.evaluate(() => {
    const state = (window as any).__m6Switch
    const appState = state.harness.getApi().getAppState()
    const camera = state.harness.runtime.getSnapshot().camera
    return {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom.value,
      revision: camera.focusRequest?.revision,
      currentSlideId: camera.currentSlideId,
    }
  })

  expect(after.currentSlideId).toBe('switch')
  expect(after.revision).toBe(before.revision)
  expect(after.scrollX).toBeCloseTo(before.scrollX, 6)
  expect(after.scrollY).toBeCloseTo(before.scrollY, 6)
  expect(after.zoom).toBeCloseTo(before.zoom, 6)
})
