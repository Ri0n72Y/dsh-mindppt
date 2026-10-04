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

test('M8 saved paths and declared SoftLink are browser-visible navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('textbox', { name: 'MindPPT source editor' })
  const canvas = page.locator('main.playground > .canvas-panel canvas.static')
  const path = page.getByRole('combobox', { name: 'Presentation path' })
  const next = page.getByRole('button', { name: 'Next path occurrence' })
  const previous = page.getByRole('button', {
    name: 'Previous path occurrence',
  })
  const pathState = page.getByLabel('Presentation path state')

  await expect(editor).toBeVisible()
  await expect(canvas).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const source = await editor.inputValue()
  expect(source).toContain('link customer -.-> summary')
  expect(source).toContain('path main {')
  expect(source).toContain('path short {')

  const withLink = await canvas.screenshot()
  await editor.fill(source.replace('link customer -.-> summary\n\n', ''))
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  const withoutLink = await expectCanvasChange(canvas, withLink)

  await editor.fill(source)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expectCanvasChange(canvas, withoutLink)

  await path.selectOption('path:main')
  await expect(page.getByText('Current: hero', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 1/6')

  await next.click()
  await expect(page.getByText('Current: agenda', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 2/6')
  await next.click()
  await expect(page.getByText('Current: customer', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 3/6')
  await next.click()
  await expect(page.getByText('Current: analysis', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 4/6')
  await next.click()
  await expect(page.getByText('Current: customer', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 5/6')

  await previous.click()
  await expect(page.getByText('Current: analysis', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 4/6')

  await path.selectOption('path:short')
  await expect(page.getByText('Current: hero', { exact: true })).toBeVisible()
  await next.click()
  await expect(page.getByText('Current: problem', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: short · 2/3')

  await path.selectOption('path:main')
  await next.click()
  await next.click()
  await expect(page.getByText('Current: customer', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 3/6')

  const follow = page.getByRole('button', {
    name: 'Follow soft link to summary',
  })
  await expect(follow).toBeVisible()
  await follow.click()
  await expect(page.getByText('Current: summary', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: —')
  await expect(follow).toHaveCount(0)

  await path.selectOption('path:main')
  await next.click()
  await next.click()
  await expect(pathState).toHaveText('Path: main · 3/6')
  await page.waitForTimeout(900)
  const lastGood = await canvas.screenshot()

  const invalid = source.replace(
    'link customer -.-> summary',
    'link customer -.-> customer',
  )
  await editor.fill(invalid)
  await expect(page.getByText('Compile error', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toContainText(
    'SoftLink cannot target its source slide',
  )
  await expect(pathState).toHaveText('Path: main · 3/6')
  await page.waitForTimeout(120)
  expect((await canvas.screenshot()).equals(lastGood)).toBe(true)

  await editor.fill(source)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 3/6')
  await expect(page.getByText('Current: customer', { exact: true })).toBeVisible()

  const contentEdit = source.replace(
    'Outdoor teams need a fast way to explain the product story.',
    'Outdoor teams need a clear way to explain the product story.',
  )
  await editor.fill(contentEdit)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: main · 3/6')

  const stalePath = contentEdit.replace(
    'path main {\n  hero\n  agenda\n  customer\n',
    'path main {\n  hero\n  agenda\n  analysis\n',
  )
  await editor.fill(stalePath)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.getByText('Current: customer', { exact: true })).toBeVisible()
  await expect(pathState).toHaveText('Path: —')
})
