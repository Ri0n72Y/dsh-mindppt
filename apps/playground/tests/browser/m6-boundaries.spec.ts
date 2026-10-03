import { expect, test } from '@playwright/test'

test('real Excalidraw conversion preserves compiler text-box geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')

  const geometry = await page.evaluate(async () => {
    const { mountAssetBrowserHarness } = await import('/src/asset-browser-harness.tsx')
    const container = document.createElement('div')
    container.style.width = '1000px'
    container.style.height = '760px'
    document.body.append(container)

    const source = `mindppt

slide fit {
  layout title-content

  # Geometry contract

  This paragraph intentionally uses enough ordinary words to wrap across several lines while remaining inside the title content semantic region.

  - First list item carries enough detail to wrap inside the semantic box.
  - Second list item also wraps without asking Excalidraw to grow the container.
  - Third list item confirms the compiler owns the final text-box geometry.
}
`
    const harness = await mountAssetBrowserHarness(
      container,
      source,
      { documentPath: 'examples/fit.mindppt', files: {} },
    )
    const elements = harness.runtime.getSnapshot().elements
    const pick = (id: string) => {
      const element = elements.find((candidate) => candidate.id === id)
      return element && {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      }
    }

    return {
      text: pick('slide:fit/text:0/box'),
      list: pick('slide:fit/list:0/box'),
    }
  })

  expect(geometry.text).toEqual({
    x: 128,
    y: 184,
    width: 1024,
    height: 121,
  })
  expect(geometry.list).toEqual({
    x: 128,
    y: 325,
    width: 1024,
    height: 176,
  })
})

test('mounted BinaryFiles replace revisions and prune removed assets', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')

  await page.evaluate(async () => {
    const { mountAssetBrowserHarness } = await import('/src/asset-browser-harness.tsx')
    const container = document.createElement('div')
    container.style.width = '1000px'
    container.style.height = '760px'
    document.body.append(container)

    const svg = (fill: string) =>
      'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">'
        + '<rect width="20" height="20" fill="' + fill + '"/>'
        + '</svg>',
      )
    const source = (asset: string) => `mindppt

slide asset {
  layout two-column

  # Asset lifecycle

  right {
    ![Fixture](./assets/${asset}.svg)
  }
}
`
    const hero = `mindppt

slide asset {
  layout hero

  # Asset removed
}
`
    const files = {
      'examples/assets/a.svg': {
        mimeType: 'image/svg+xml',
        dataURL: svg('#dc2626'),
      },
      'examples/assets/b.svg': {
        mimeType: 'image/svg+xml',
        dataURL: svg('#2563eb'),
      },
    }
    const harness = await mountAssetBrowserHarness(
      container,
      source('a'),
      { documentPath: 'examples/assets.mindppt', files },
    )

    ;(window as any).__m6Files = { harness, files, source, hero, svg }
  })

  await expect.poll(() => page.evaluate(() => {
    const state = (window as any).__m6Files
    return Object.keys(state.harness.getMountedFiles()).length
  })).toBe(1)

  const firstId = await page.evaluate(() => {
    const state = (window as any).__m6Files
    const image = state.harness.runtime.getSnapshot().elements
      .find((element: any) => element.type === 'image')
    return image.fileId
  })

  const replacedId = await page.evaluate(() => {
    const state = (window as any).__m6Files
    state.files['examples/assets/a.svg'] = {
      mimeType: 'image/svg+xml',
      dataURL: state.svg('#16a34a'),
    }
    state.harness.runtime.setSource(state.source('a'))
    const image = state.harness.runtime.getSnapshot().elements
      .find((element: any) => element.type === 'image')
    return image.fileId
  })
  expect(replacedId).not.toBe(firstId)
  await expect.poll(() => page.evaluate((expected) => {
    const state = (window as any).__m6Files
    return Object.keys(state.harness.getMountedFiles()).sort()
      .join(',') === expected
  }, replacedId)).toBe(true)

  const bId = await page.evaluate(() => {
    const state = (window as any).__m6Files
    state.harness.runtime.setSource(state.source('b'))
    const image = state.harness.runtime.getSnapshot().elements
      .find((element: any) => element.type === 'image')
    return image.fileId
  })
  await expect.poll(() => page.evaluate((expected) => {
    const state = (window as any).__m6Files
    return Object.keys(state.harness.getMountedFiles()).sort()
      .join(',') === expected
  }, bId)).toBe(true)

  await page.evaluate(() => {
    const state = (window as any).__m6Files
    state.harness.runtime.setSource(state.hero)
  })
  await expect.poll(() => page.evaluate(() => {
    const state = (window as any).__m6Files
    return Object.keys(state.harness.getMountedFiles()).length
  })).toBe(0)

  await page.evaluate(() => {
    const state = (window as any).__m6Files
    const invalid = state.source('b').replace(/\n}\n$/, '\n')
    state.harness.runtime.setSource(invalid)
    state.harness.runtime.setSource(state.source('b'))
  })
  await expect.poll(() => page.evaluate((expected) => {
    const state = (window as any).__m6Files
    return Object.keys(state.harness.getMountedFiles()).sort()
      .join(',') === expected
  }, bId)).toBe(true)
})

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
