import { expect, test, type Locator } from '@playwright/test'

async function expectCanvasChange(
  canvas: Locator,
  previous: Buffer,
): Promise<Buffer> {
  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(previous)
  }, {
    timeout: 5_000,
    intervals: [100, 120, 160, 200],
  }).toBe(false)

  await pagePause(canvas, 120)
  return canvas.screenshot()
}

async function pagePause(canvas: Locator, milliseconds: number): Promise<void> {
  await canvas.evaluate((_, timeout) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeout)
  }), milliseconds)
}

async function readVisibleBarHeights(canvas: Locator): Promise<number[]> {
  return canvas.evaluate((element) => {
    const node = element as HTMLCanvasElement
    const context = node.getContext('2d')
    if (!context) return []

    const data = context.getImageData(0, 0, node.width, node.height).data
    const counts = Array.from({ length: node.width }, () => 0)

    for (let y = 0; y < node.height; y += 1) {
      for (let x = 0; x < node.width; x += 1) {
        const index = (y * node.width + x) * 4
        const red = data[index] ?? 0
        const green = data[index + 1] ?? 0
        const blue = data[index + 2] ?? 0
        const alpha = data[index + 3] ?? 0

        if (
          Math.abs(red - 99) <= 18
          && Math.abs(green - 102) <= 18
          && Math.abs(blue - 241) <= 18
          && alpha > 220
        ) {
          counts[x]! += 1
        }
      }
    }

    const groups: number[][] = []
    let current: number[] = []

    for (let x = 0; x < counts.length; x += 1) {
      if ((counts[x] ?? 0) >= 4) {
        current.push(counts[x] ?? 0)
      } else if (current.length) {
        if (current.length >= 8) groups.push(current)
        current = []
      }
    }
    if (current.length >= 8) groups.push(current)

    return groups.map((group) => Math.max(...group))
  })
}

test('M7.1 table and bar chart are visible and live through last-good recovery', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('textbox', { name: 'MindPPT source editor' })
  const canvas = page.locator('main.playground > .canvas-panel canvas.static')
  const cameraTarget = page.getByRole('combobox', { name: 'Camera slide target' })

  await expect(editor).toBeVisible()
  await expect(canvas).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const source = await editor.inputValue()
  expect(source).toContain('table {')
  expect(source).toContain('chart bar {')
  expect(source).toContain('values [184, 121, 96]')

  await cameraTarget.selectOption('analysis')
  await expect(page.getByText('Current: analysis', { exact: true })).toBeVisible()
  await page.waitForTimeout(900)

  const initialBars = await readVisibleBarHeights(canvas)
  expect(initialBars).toHaveLength(3)
  expect(initialBars[0]).toBeGreaterThan(initialBars[1] ?? 0)
  expect(initialBars[1]).toBeGreaterThan(initialBars[2] ?? 0)

  const initial = await canvas.screenshot()
  const tableEdit = source.replace(
    'row ["Partner", 121, 31900]',
    'row ["Partner", 121, 33750]',
  )
  await editor.fill(tableEdit)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  const afterTable = await expectCanvasChange(canvas, initial)

  const chartEdit = tableEdit.replace(
    'values [184, 121, 96]',
    'values [184, 160, 96]',
  )
  await editor.fill(chartEdit)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  const afterChart = await expectCanvasChange(canvas, afterTable)

  const editedBars = await readVisibleBarHeights(canvas)
  expect(editedBars).toHaveLength(3)
  expect(editedBars[1]).toBeGreaterThan(initialBars[1] ?? 0)
  expect(editedBars[0]).toBeGreaterThan(editedBars[1] ?? 0)
  expect(editedBars[1]).toBeGreaterThan(editedBars[2] ?? 0)

  const invalid = chartEdit.replace(
    'values [184, 160, 96]',
    'values [184, "bad", 96]',
  )
  await editor.fill(invalid)
  await expect(page.getByText('Compile error', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toContainText(
    'chart values must be finite numbers',
  )
  await page.waitForTimeout(120)
  expect((await canvas.screenshot()).equals(afterChart)).toBe(true)

  const repaired = invalid.replace(
    'values [184, "bad", 96]',
    'values [184, 175, 96]',
  )
  await editor.fill(repaired)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toHaveCount(0)
  await expectCanvasChange(canvas, afterChart)
})
