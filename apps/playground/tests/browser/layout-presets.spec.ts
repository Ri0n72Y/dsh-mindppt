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

  await page.evaluate(async () => {
    const { mountAssetBrowserHarness } = await import(
      '/src/asset-browser-harness.tsx'
    )
    const editor = document.querySelector<HTMLTextAreaElement>(
      '[aria-label="MindPPT source editor"]',
    )
    if (!editor) throw new Error('Missing source editor')

    const container = document.createElement('div')
    container.style.width = '1200px'
    container.style.height = '760px'
    document.body.append(container)

    const harness = await mountAssetBrowserHarness(
      container,
      editor.value,
      { documentPath: 'examples/m6-layout-presets.mindppt', files: {} },
    )

    Object.assign(window, { __mindPptFontHarness: harness })
  })

  await page.waitForFunction(() => {
    const harness = (window as any).__mindPptFontHarness
    return Boolean(harness?.getApi())
  })

  const beforeFonts = await readPresetTextGeometry(page)

  releaseFonts()
  await page.evaluate(() => document.fonts.ready)

  await expect.poll(
    () => readPresetTextGeometry(page),
    { timeout: 5_000, intervals: [50, 100, 150, 200] },
  ).not.toEqual(beforeFonts)

  const afterFonts = await readPresetTextGeometry(page)

  await page.evaluate(() => {
    const harness = (window as any).__mindPptFontHarness
    const source = harness.runtime.getSnapshot().source
    harness.runtime.setSource(source + '\n')
  })

  await expect.poll(
    () => readPresetTextGeometry(page),
    { timeout: 5_000, intervals: [50, 100, 150, 200] },
  ).toEqual(afterFonts)

  const afterRecompile = await readPresetTextGeometry(page)
  expect(afterRecompile).toEqual(afterFonts)
})

async function readPresetTextGeometry(page: Page) {
  return page.evaluate(() => {
    const harness = (window as any).__mindPptFontHarness
    const elements = harness.getApi().getSceneElements()
    const prefixes = ['slide:hero/', 'slide:agenda/']

    return elements
      .filter((element: any) => {
        if (element.type === 'text') {
          return prefixes.some((prefix) => element.containerId?.startsWith(prefix))
        }
        return prefixes.some((prefix) => element.id?.startsWith(prefix))
          && element.type === 'rectangle'
          && element.id !== 'slide:hero/surface'
          && element.id !== 'slide:agenda/surface'
      })
      .map((element: any) => ({
        key: element.type === 'text' ? element.containerId : element.id,
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        text: element.type === 'text' ? element.text : undefined,
        fontSize: element.type === 'text' ? element.fontSize : undefined,
        lineHeight: element.type === 'text' ? element.lineHeight : undefined,
      }))
      .sort((a: any, b: any) =>
        (a.key + ':' + a.type).localeCompare(b.key + ':' + b.type),
      )
  })
}
