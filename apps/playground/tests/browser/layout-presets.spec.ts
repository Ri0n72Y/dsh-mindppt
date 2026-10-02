import { expect, test, type Locator, type Page } from '@playwright/test'

async function focusAndCapture(
  page: Page,
  canvas: Locator,
  slideId: string,
): Promise<Buffer> {
  const previous = await canvas.screenshot()
  await page.getByRole('combobox', { name: 'Camera slide target' })
    .selectOption(slideId)
  await expect(page.getByText('Current: ' + slideId, { exact: true }))
    .toBeVisible()

  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(previous)
  }, {
    timeout: 5_000,
    intervals: [100, 120, 160, 200],
  }).toBe(false)

  await page.waitForTimeout(900)
  return canvas.screenshot()
}

test('hero, title-content, and two-column are visibly distinct in Chromium', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const canvas = page.locator('.canvas-panel canvas.static')
  await expect(canvas).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const hero = await focusAndCapture(page, canvas, 'hero')
  const agenda = await focusAndCapture(page, canvas, 'agenda')
  const customer = await focusAndCapture(page, canvas, 'customer')

  expect(agenda.equals(hero)).toBe(false)
  expect(customer.equals(hero)).toBe(false)
  expect(customer.equals(agenda)).toBe(false)
})
