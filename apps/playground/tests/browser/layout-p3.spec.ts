import { expect, test } from '@playwright/test'

test('P3 dense table rows, wrapped category labels and signed baseline in Chromium', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')
  await page.evaluate(async () => {
    const { mountAssetBrowserHarness } = await import('/src/asset-browser-harness.tsx')
    const container = document.createElement('div')
    container.id = 'p3-harness'
    container.style.cssText = 'position:fixed;inset:0;width:1200px;height:800px;z-index:100;background:white'
    document.body.append(container)
    const style = document.createElement('style')
    style.textContent = '#p3-harness .canvas-panel {width:1200px;height:800px}'
    document.head.append(style)
    const source = `mindppt
slide signed {
  layout two-column
  # Results
  left {
    table {
      header ["Quarter", "Value"]
      row ["Jan", 1]
      row ["Feb", 2]
      row ["Mar", 3]
      row ["Apr", 4]
      row ["May", 5]
      row ["Jun", 6]
      row ["Jul", 7]
      row ["Aug", 8]
      row ["Sep", 9]
      row ["Oct", 10]
      row ["Nov", 11]
      row ["Dec", 12]
    }
  }
  right {
    chart bar {
      labels ["Quarterly Direct Revenue", "No sales", "Operating losses"]
      values [18, 0, -12]
    }
  }
}
`
    const harness = await mountAssetBrowserHarness(container, source, {
      documentPath: 'examples/p3.mindppt', files: {},
    })
    ;(window as any).__p3 = harness
  })
  await expect(page.locator('#p3-harness canvas.static')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__p3.getApi()?.getSceneElements().length ?? 0,
  )).toBeGreaterThan(60)

  const measured = await page.evaluate(() => {
    const scene = (window as any).__p3.getApi().getSceneElements()
    const find = (id: string) => scene.find((el: any) => el.id === id)
    const prefix = 'slide:signed/right/bar-chart:0'
    const labels = [0, 1, 2].map(n => {
      const box = find(`${prefix}/bar:${n}/label`)
      const text = scene.find((el: any) => el.type === 'text' && el.containerId === box.id)
      return { box, text }
    })
    const values = [0, 1, 2].map(n => {
      const box = find(`${prefix}/bar:${n}/value`)
      const text = scene.find((el: any) => el.type === 'text' && el.containerId === box.id)
      return { box, text }
    })
    const rows = Array.from({ length: 12 }, (_, n) => {
      const cell = find(`slide:signed/left/table:0/row:${n}/cell:0/box`)
      const text = scene.find((el: any) => el.type === 'text' && el.containerId === cell.id)
      return { cell, text }
    })
    const bars = [0, 1, 2].map(n => find(`${prefix}/bar:${n}/box`))
    return { labels, values, rows, bars, baseline: find(prefix + '/baseline') }
  })
  expect(measured.rows).toHaveLength(12)
  for (const row of measured.rows) {
    expect(row.text?.text).toBeTruthy()
    expect(row.text.height).toBeLessThanOrEqual(row.cell.height + 0.5)
  }
  for (const [n, label] of measured.labels.entries()) {
    expect(label.text?.text).toBeTruthy()
    expect(label.text.height).toBeLessThanOrEqual(label.box.height + 0.5)
    expect(label.text.x).toBeGreaterThanOrEqual(label.box.x - 1)
    expect(label.text.x + label.text.width).toBeLessThanOrEqual(label.box.x + label.box.width + 1)
    if (n > 0) {
      expect(measured.labels[n - 1]!.text.x + measured.labels[n - 1]!.text.width)
        .toBeLessThanOrEqual(label.text.x + 1)
    }
  }
  expect(measured.values.map(v => v.text.text)).toEqual(['18', '0', '-12'])
  expect(measured.bars[1].height).toBe(1)
  expect(measured.bars[0].y + measured.bars[0].height)
    .toBeCloseTo(measured.baseline.y)
  expect(measured.bars[2].y).toBeCloseTo(measured.baseline.y)
  expect(measured.values[0].box.y + measured.values[0].box.height)
    .toBeLessThanOrEqual(measured.bars[0].y)
  expect(measured.values[2].box.y)
    .toBeGreaterThanOrEqual(measured.bars[2].y + measured.bars[2].height)
})
