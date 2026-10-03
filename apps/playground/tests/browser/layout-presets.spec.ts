import { expect, test, type Locator, type Page } from '@playwright/test'

const COLD_LOAD_SOURCE = [
  'mindppt',
  '',
  'tree LR {',
  '  hero --> agenda',
  '}',
  '',
  'slide hero {',
  '  layout hero',
  '',
  '  # Product Direction',
  '  ## 2026 review',
  '',
  '  A short supporting statement.',
  '}',
  '',
  'slide agenda {',
  '  layout title-content',
  '',
  '  # Executive Summary',
  '',
  '  The title occupies its own semantic area.',
  '',
  '  - Ordinary Markdown remains ordinary content',
  '  - Geometry is deterministic from the slide box',
  '}',
  '',
].join('\n')

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

test('cold load mounts font-ready hero and agenda geometry without a source edit', async ({ page }) => {
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

  await page.evaluate(async (source) => {
    const { mountAssetBrowserHarness } = await import(
      '/src/asset-browser-harness.tsx'
    )
    const container = document.createElement('div')
    container.style.width = '1200px'
    container.style.height = '800px'
    document.body.append(container)

    const harness = await mountAssetBrowserHarness(
      container,
      source,
      { documentPath: 'examples/cold-load.mindppt', files: {} },
    )

    ;(window as typeof window & { __coldHarness?: typeof harness })
      .__coldHarness = harness
  }, COLD_LOAD_SOURCE)

  await expect.poll(() => page.evaluate(() => {
    const harness = (
      window as typeof window & {
        __coldHarness?: { getApi: () => unknown }
      }
    ).__coldHarness
    return Boolean(harness?.getApi())
  })).toBe(true)

  releaseFonts()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)

  const fontReady = await readColdLoadGeometry(page)

  expect(Object.values(fontReady).every(({ box, text }) =>
    text.width <= box.width
    && text.height <= box.height
    && text.x >= box.x
    && text.y >= box.y
    && text.x + text.width <= box.x + box.width
    && text.y + text.height <= box.y + box.height
  )).toBe(true)

  await page.evaluate((source) => {
    const harness = (
      window as typeof window & {
        __coldHarness?: { runtime: { setSource: (value: string) => void } }
      }
    ).__coldHarness
    harness?.runtime.setSource(source + '\n')
  }, COLD_LOAD_SOURCE)

  await expect.poll(() => readColdLoadGeometry(page), {
    timeout: 3_000,
    intervals: [50, 100, 150],
  }).toEqual(fontReady)
})

async function readColdLoadGeometry(page: Page) {
  return page.evaluate(() => {
    const harness = (
      window as typeof window & {
        __coldHarness?: {
          getApi: () => {
            getSceneElements: () => Array<{
              id: string
              type: string
              x: number
              y: number
              width: number
              height: number
              text?: string
              fontFamily?: number
              fontSize?: number
              lineHeight?: number
              boundElements?: Array<{ id: string; type: string }> | null
            }>
          } | null
        }
      }
    ).__coldHarness
    const scene = harness?.getApi()?.getSceneElements() ?? []

    const pick = (boxId: string) => {
      const box = scene.find((element) => element.id === boxId)
      const textId = box?.boundElements?.find(
        (element) => element.type === 'text',
      )?.id
      const text = scene.find((element) => element.id === textId)

      if (!box || !text || text.type !== 'text') {
        throw new Error('Missing bound text for ' + boxId)
      }

      return {
        box: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
        text: {
          x: text.x,
          y: text.y,
          width: text.width,
          height: text.height,
          text: text.text,
          fontFamily: text.fontFamily,
          fontSize: text.fontSize,
          lineHeight: text.lineHeight,
        },
      }
    }

    return {
      heroTitle: pick('slide:hero/title:0/box'),
      heroSubtitle: pick('slide:hero/subtitle:0/box'),
      heroText: pick('slide:hero/text:0/box'),
      agendaTitle: pick('slide:agenda/title:0/box'),
      agendaText: pick('slide:agenda/text:0/box'),
      agendaList: pick('slide:agenda/list:0/box'),
    }
  })
}
