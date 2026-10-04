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
  return canvas.screenshot()
}

test('M9 LaTeX renderer load and unload reprojects the same source', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('textbox', { name: 'MindPPT source editor' })
  const canvas = page.locator('main.playground > .canvas-panel canvas.static')
  const path = page.getByRole('combobox', { name: 'Presentation path' })
  const next = page.getByRole('button', { name: 'Next path occurrence' })
  const active = page.getByLabel('Active extension renderers')

  await expect(editor).toBeVisible()
  await expect(canvas).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const source = await editor.inputValue()
  expect(source).toContain('e^{i\\pi} + 1 = 0')
  await expect(active).toHaveText('Active: none')

  await path.selectOption('path:short')
  await next.click()
  await expect(page.getByText('Current: problem', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Presentation path state')).toHaveText(
    'Path: short · 2/3',
  )
  await page.waitForTimeout(900)

  const fallback = await canvas.screenshot()

  await page.getByRole('button', { name: 'Enable LaTeX renderer' }).click()
  await expect(active).toHaveText('Active: latex')
  await expect(editor).toHaveValue(source)
  await expect(page.getByText('Current: problem', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Presentation path state')).toHaveText(
    'Path: short · 2/3',
  )
  const specialized = await expectCanvasChange(canvas, fallback)

  await page.getByRole('button', { name: 'Disable LaTeX renderer' }).click()
  await expect(active).toHaveText('Active: none')
  await expect(editor).toHaveValue(source)
  await expect(page.getByText('Current: problem', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Presentation path state')).toHaveText(
    'Path: short · 2/3',
  )
  const restored = await expectCanvasChange(canvas, specialized)
  expect(restored.equals(fallback)).toBe(true)

  await page.getByRole('button', { name: 'Enable LaTeX renderer' }).click()
  await expect(active).toHaveText('Active: latex')
  await expectCanvasChange(canvas, restored)
  await expect(editor).toHaveValue(source)
})
