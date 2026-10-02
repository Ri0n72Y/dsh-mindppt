import { readFileSync } from 'node:fs'

import { expect, test, type Locator } from '@playwright/test'

const M4 = readFileSync(
  new URL('../../../../examples/m4-branching-lr-tree.mindppt', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

async function expectCanvasTransitionToSettle(
  canvas: Locator,
  previous: Buffer,
): Promise<void> {
  let last = previous
  let changed = false
  let stableSamples = 0

  await expect.poll(async () => {
    const current = await canvas.screenshot()

    if (!current.equals(previous)) changed = true
    if (changed && current.equals(last)) {
      stableSamples += 1
    } else {
      stableSamples = 0
    }
    last = current

    return changed && stableSamples >= 2
  }, {
    timeout: 5_000,
    intervals: [100, 120, 160, 200],
  }).toBe(true)
}

async function countFixturePixels(canvas: Locator): Promise<number> {
  return canvas.evaluate((element) => {
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
        red >= 115 && red <= 135
        && green >= 48 && green <= 70
        && blue >= 228 && blue <= 245
        && alpha > 240
      ) {
        count += 1
      }
    }

    return count
  })
}

test('M6 image pipeline extends live authoring without regressing M5 camera navigation', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('textbox', { name: 'MindPPT source editor' })
  const canvas = page.locator('.canvas-panel canvas.static')

  await expect(editor).toBeVisible()
  await expect(canvas).toBeVisible()
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.getByText('Current: overview', { exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const m6Source = await editor.inputValue()
  expect(m6Source).toContain('layout two-column')
  expect(m6Source).toContain('![Customer workshop](./assets/customer.svg)')

  await expect.poll(
    () => countFixturePixels(canvas),
    { timeout: 5_000 },
  ).toBeGreaterThan(100)

  const initialScene = await canvas.screenshot()
  const validEdit = m6Source.replace(
    '# Customer Profile',
    '# Live Customer Profile',
  )
  await editor.fill(validEdit)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()

  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(initialScene)
  }).toBe(false)
  await expect.poll(() => countFixturePixels(canvas)).toBeGreaterThan(100)

  const lastGood = await canvas.screenshot()
  const invalidEdit = validEdit.replace(/\n}\n?$/, '\n')
  await editor.fill(invalidEdit)

  await expect(page.getByText('Compile error', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toContainText('Expected block-end')
  await page.waitForTimeout(100)

  const afterError = await canvas.screenshot()
  expect(afterError.equals(lastGood)).toBe(true)
  await expect.poll(() => countFixturePixels(canvas)).toBeGreaterThan(100)

  const recovered = invalidEdit + '}\n'
  await editor.fill(recovered)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toHaveCount(0)

  const missingAsset = recovered.replace(
    './assets/customer.svg',
    './assets/missing.svg',
  )
  await editor.fill(missingAsset)
  await expect(page.getByText('Compiled with warning', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic-warning')).toContainText(
    'Local asset not found: ./assets/missing.svg',
  )

  await editor.fill(recovered)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toHaveCount(0)
  await expect.poll(() => countFixturePixels(canvas)).toBeGreaterThan(100)

  await editor.fill(M4)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toHaveCount(0)
  expect((await editor.inputValue()).match(/^slide /gm)).toHaveLength(6)

  const overviewScene = await canvas.screenshot()
  const cameraTarget = page.getByRole('combobox', { name: 'Camera slide target' })

  await cameraTarget.selectOption('intro')
  await expect(page.getByText('Current: intro', { exact: true })).toBeVisible()
  await expectCanvasTransitionToSettle(canvas, overviewScene)

  const introScene = await canvas.screenshot()
  await page.getByRole('button', { name: 'Focus child market' }).click()
  await expect(page.getByText('Current: market', { exact: true })).toBeVisible()
  await expectCanvasTransitionToSettle(canvas, introScene)

  const marketScene = await canvas.screenshot()
  await page.getByRole('button', { name: 'Focus parent intro' }).click()
  await expect(page.getByText('Current: intro', { exact: true })).toBeVisible()
  await expectCanvasTransitionToSettle(canvas, marketScene)

  const returnedIntroScene = await canvas.screenshot()
  await cameraTarget.selectOption('solution')
  await expect(page.getByText('Current: solution', { exact: true })).toBeVisible()
  await expectCanvasTransitionToSettle(canvas, returnedIntroScene)

  const solutionScene = await canvas.screenshot()
  await cameraTarget.selectOption('market')
  await expect(page.getByText('Current: market', { exact: true })).toBeVisible()
  await cameraTarget.selectOption('solution')
  await expect(page.getByText('Current: solution', { exact: true })).toBeVisible()
  await expectCanvasTransitionToSettle(canvas, solutionScene)
})
