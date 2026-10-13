import { expect, test, type Locator } from '@playwright/test'

async function paintedBounds(
  canvas: Locator,
  rgb: readonly [number, number, number],
): Promise<{ width: number; height: number; count: number } | null> {
  return canvas.evaluate((node, color) => {
    const surface = node as HTMLCanvasElement
    const ctx = surface.getContext('2d')
    if (!ctx) return null
    const pixels = ctx.getImageData(0, 0, surface.width, surface.height).data
    let left = surface.width
    let top = surface.height
    let right = -1
    let bottom = -1
    let count = 0
    for (let y = 0; y < surface.height; y += 2) {
      for (let x = 0; x < surface.width; x += 2) {
        const index = (y * surface.width + x) * 4
        if (Math.abs((pixels[index] ?? 0) - color[0]) > 12
          || Math.abs((pixels[index + 1] ?? 0) - color[1]) > 12
          || Math.abs((pixels[index + 2] ?? 0) - color[2]) > 12
          || (pixels[index + 3] ?? 0) < 240) continue
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
        count += 1
      }
    }
    return count ? { width: right - left + 2, height: bottom - top + 2, count } : null
  }, rgb)
}

test('portrait SVG and landscape PNG paint centered contain; same-path orientation changes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')
  await page.evaluate(async () => {
    const { mountAssetBrowserHarness } = await import('/src/asset-browser-harness.tsx')
    const container = document.createElement('div')
    container.id = 'contain-harness'
    container.style.cssText = 'position:fixed;inset:0;width:1000px;height:740px;z-index:100;background:white'
    document.body.append(container)
    const style = document.createElement('style')
    style.textContent = '#contain-harness .canvas-panel {width:1000px;height:740px}'
    document.head.append(style)
    const svg = (width: number, height: number, fill: string) =>
      'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`,
      )
    const png = document.createElement('canvas')
    png.width = 320
    png.height = 100
    const ctx = png.getContext('2d')!
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(0, 0, 320, 100)
    const files = {
      'examples/assets/portrait.svg': {
        mimeType: 'image/svg+xml', dataURL: svg(80, 240, '#dc2626'),
      },
      'examples/assets/landscape.png': {
        mimeType: 'image/png', dataURL: png.toDataURL('image/png'),
      },
    }
    const source = `mindppt
slide photos {
  layout two-column
  # Images
  left {
    ![Portrait](./assets/portrait.svg)
  }
  right {
    ![Landscape](./assets/landscape.png)
  }
}
`
    const harness = await mountAssetBrowserHarness(container, source, {
      documentPath: 'examples/contain.mindppt', files,
    })
    ;(window as any).__contain = { harness, files, source, svg }
  })
  const canvas = page.locator('#contain-harness canvas.static')
  await expect(canvas).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const { harness } = (window as any).__contain
    return harness.runtime.getSnapshot().elements.filter(
      (element: any) => element.type === 'image',
    ).map((image: any) => [image.id, image.x, image.y, image.width, image.height])
  })).toEqual([
    ['slide:photos/left/image:0', 291, 176, 130, 390],
    ['slide:photos/right/image:0', 664, 289.75, 520, 162.5],
  ])
  await expect.poll(async () => (await paintedBounds(canvas, [220, 38, 38]))?.count ?? 0)
    .toBeGreaterThan(100)
  await expect.poll(async () => (await paintedBounds(canvas, [37, 99, 235]))?.count ?? 0)
    .toBeGreaterThan(100)
  const portrait = (await paintedBounds(canvas, [220, 38, 38]))!
  const landscape = (await paintedBounds(canvas, [37, 99, 235]))!
  expect(portrait.width / portrait.height).toBeCloseTo(80 / 240, 1)
  expect(landscape.width / landscape.height).toBeCloseTo(320 / 100, 1)

  const originalId = await page.evaluate(() => (window as any).__contain.harness
    .runtime.getSnapshot().elements.find((el: any) => el.type === 'image').fileId)
  await page.evaluate(() => {
    const state = (window as any).__contain
    state.files['examples/assets/portrait.svg'] = {
      mimeType: 'image/svg+xml', dataURL: state.svg(400, 100, '#16a34a'),
    }
    state.harness.runtime.setSource(state.source)
  })
  await expect.poll(async () => page.evaluate(() => {
    const snapshot = (window as any).__contain.harness.runtime.getSnapshot()
    const image = snapshot.elements.find((el: any) => el.id === 'slide:photos/left/image:0')
    return [image.x, image.y, image.width, image.height, image.fileId === snapshot.files[image.fileId]?.id]
  })).toEqual([96, 306, 520, 130, true])
  const newId = await page.evaluate(() => (window as any).__contain.harness
    .runtime.getSnapshot().elements.find((el: any) => el.type === 'image').fileId)
  expect(newId).not.toBe(originalId)
  await expect.poll(async () => (await paintedBounds(canvas, [22, 163, 74]))?.count ?? 0)
    .toBeGreaterThan(100)
  await expect.poll(async () => (await paintedBounds(canvas, [220, 38, 38]))?.count ?? 0)
    .toBe(0)
  const replaced = (await paintedBounds(canvas, [22, 163, 74]))!
  expect(replaced.width / replaced.height).toBeCloseTo(4, 1)
  console.log('P3a browser pixel evidence', JSON.stringify({
    portrait, landscape, replaced, samePathNewFileId: originalId !== newId,
  }))
})
