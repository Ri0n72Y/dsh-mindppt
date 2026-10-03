import { expect, test } from '@playwright/test'

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
