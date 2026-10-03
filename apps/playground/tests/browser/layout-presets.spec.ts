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

test('cold load reaches font-ready hero and agenda geometry without a source edit', async ({ page }) => {
  let releaseFonts = () => {}
  const fontGate = new Promise<void>((resolve) => {
    releaseFonts = resolve
  })

  await page.route(/\.woff2(?:\?|$)/, async (route) => {
    await fontGate
    await route.continue()
  })

  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const canvas = page.locator('.canvas-panel canvas.static')
  const editor = page.getByRole('textbox', { name: 'MindPPT source editor' })
  await expect(canvas).toBeVisible()

  await page.getByRole('combobox', { name: 'Camera slide target' })
    .selectOption('hero')
  await expect(page.getByText('Current: hero', { exact: true }))
    .toBeVisible()
  await page.waitForTimeout(900)

  releaseFonts()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(100)

  const hero = await canvas.screenshot()
  const agenda = await focusAndCapture(page, canvas, 'agenda')
  const source = await editor.inputValue()

  await editor.fill(source + '\n')
  await expect(editor).toHaveValue(source + '\n')
  await page.waitForTimeout(150)

  const agendaAfterRecompile = await canvas.screenshot()
  const heroAfterRecompile = await focusAndCapture(page, canvas, 'hero')

  expect(agendaAfterRecompile.equals(agenda)).toBe(true)
  expect(heroAfterRecompile.equals(hero)).toBe(true)
})
