import { expect, test, type Locator } from '@playwright/test'

async function countColorPixels(
  canvas: Locator,
  target: readonly [number, number, number],
): Promise<number> {
  return canvas.evaluate((element, [targetRed, targetGreen, targetBlue]) => {
    const node = element as HTMLCanvasElement
    const context = node.getContext('2d')
    if (!context) return 0

    const data = context.getImageData(0, 0, node.width, node.height).data
    let count = 0

    for (let index = 0; index < data.length; index += 16) {
      const red = data[index] ?? 0
      const green = data[index + 1] ?? 0
      const blue = data[index + 2] ?? 0
      const alpha = data[index + 3] ?? 0

      if (
        Math.abs(red - targetRed) <= 12
        && Math.abs(green - targetGreen) <= 12
        && Math.abs(blue - targetBlue) <= 12
        && alpha > 240
      ) {
        count += 1
      }
    }

    return count
  }, target)
}

test('same-path asset replacement changes binary identity and visible bytes', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  await page.evaluate(async () => {
    const modulePath = '/src/asset-browser-harness.tsx'
    const { mountAssetBrowserHarness } = await import(modulePath)
    const container = document.createElement('div')
    container.id = 'asset-replacement-harness'
    container.style.width = '900px'
    container.style.height = '700px'
    container.style.position = 'fixed'
    container.style.inset = '0'
    container.style.zIndex = '100'
    container.style.background = '#ffffff'

    const style = document.createElement('style')
    style.textContent = `
      #asset-replacement-harness .canvas-panel {
        width: 900px;
        height: 700px;
      }
    `
    document.head.append(style)
    document.body.append(container)

    const source = `mindppt

slide asset {
  layout two-column

  # Replacement

  right {
    ![Fixture](./assets/replacement.svg)
  }
}
`
    const svg = (fill: string) =>
      'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        + '<rect width="100" height="100" fill="' + fill + '"/>'
        + '</svg>',
      )
    const files = {
      'examples/assets/replacement.svg': {
        mimeType: 'image/svg+xml',
        dataURL: svg('#dc2626'),
      },
    }
    const harness = await mountAssetBrowserHarness(
      container,
      source,
      { documentPath: 'examples/replacement.mindppt', files },
    )

    ;(window as any).__assetReplacement = { harness, files, source, svg }
  })

  const canvas = page.locator('#asset-replacement-harness canvas.static')
  await expect(canvas).toBeVisible()
  await expect.poll(
    () => countColorPixels(canvas, [220, 38, 38]),
    { timeout: 5_000 },
  ).toBeGreaterThan(100)

  const first = await page.evaluate(() => {
    const state = (window as any).__assetReplacement
    const snapshot = state.harness.runtime.getSnapshot()
    const image = snapshot.elements.find((element: any) => element.type === 'image')
    return { id: image.id, fileId: image.fileId }
  })

  const unchanged = await page.evaluate(() => {
    const state = (window as any).__assetReplacement
    state.harness.runtime.setSource(state.source)
    const snapshot = state.harness.runtime.getSnapshot()
    const image = snapshot.elements.find((element: any) => element.type === 'image')
    return { id: image.id, fileId: image.fileId }
  })
  expect(unchanged).toEqual(first)

  const replaced = await page.evaluate(() => {
    const state = (window as any).__assetReplacement
    state.files['examples/assets/replacement.svg'] = {
      mimeType: 'image/svg+xml',
      dataURL: state.svg('#16a34a'),
    }
    state.harness.runtime.setSource(state.source)
    const snapshot = state.harness.runtime.getSnapshot()
    const image = snapshot.elements.find((element: any) => element.type === 'image')
    return {
      id: image.id,
      fileId: image.fileId,
      dataURL: snapshot.files[image.fileId]?.dataURL,
    }
  })

  expect(replaced.id).toBe(first.id)
  expect(replaced.fileId).not.toBe(first.fileId)
  expect(replaced.dataURL).toContain('%2316a34a')
  await expect.poll(
    () => countColorPixels(canvas, [22, 163, 74]),
    { timeout: 5_000 },
  ).toBeGreaterThan(100)
})
