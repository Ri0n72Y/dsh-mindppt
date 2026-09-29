import { expect, test } from '@playwright/test'

test('M5 camera focus extends the M4 live authoring browser path', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('textbox', { name: 'MindPPT source editor' })
  const canvas = page.locator('.canvas-panel canvas.static')

  await expect(editor).toBeVisible()
  await expect(canvas).toBeVisible()
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.getByText('Current: overview', { exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const initialSource = await editor.inputValue()
  expect(initialSource).toContain('market --> customer')
  expect(initialSource.match(/^slide /gm)).toHaveLength(6)

  const beforeEdit = await canvas.screenshot()

  const validEdit = initialSource.replace('# Outdoor Market', '# Live Market')
  await editor.fill(validEdit)
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()

  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(beforeEdit)
  }).toBe(false)

  const lastGood = await canvas.screenshot()
  const invalidEdit = validEdit.replace(/\n}\n?$/, '\n')

  await editor.fill(invalidEdit)
  await expect(page.getByText('Compile error', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toContainText('Expected block-end')

  const diagnostic = page.locator('.diagnostic')
  await diagnostic.click()
  const selection = await editor.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement
    return [textarea.selectionStart, textarea.selectionEnd]
  })
  expect(selection[0]).toBeGreaterThan(0)

  await page.waitForTimeout(100)
  const afterError = await canvas.screenshot()
  expect(afterError.equals(lastGood)).toBe(true)

  const recoveredEdit = `${invalidEdit.replace(
    '# Live Market',
    '# Recovered Market',
  )}}
`
  await editor.fill(recoveredEdit)

  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toHaveCount(0)
  await expect(editor).toHaveValue(recoveredEdit)

  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(lastGood)
  }).toBe(false)

  const recoveredScene = await canvas.screenshot()
  const directionEdit = recoveredEdit.replace('tree LR {', 'tree BT {')
  await editor.fill(directionEdit)

  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic')).toHaveCount(0)

  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(recoveredScene)
  }).toBe(false)

  const directionScene = await canvas.screenshot()
  const warningEdit = `${directionEdit}
slide orphan {
  # Orphan
}
`
  await editor.fill(warningEdit)

  await expect(page.getByText('Compiled with warning', { exact: true })).toBeVisible()
  await expect(page.locator('.diagnostic-warning')).toContainText(
    'Slide "orphan" is unreachable from primary tree root "intro"',
  )

  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(directionScene)
  }).toBe(false)

  const overviewScene = await canvas.screenshot()
  const cameraTarget = page.getByRole('combobox', { name: 'Camera slide target' })

  await cameraTarget.selectOption('intro')
  await expect(page.getByText('Current: intro', { exact: true })).toBeVisible()
  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(overviewScene)
  }).toBe(false)

  const introScene = await canvas.screenshot()
  await page.getByRole('button', { name: 'Focus child market' }).click()
  await expect(page.getByText('Current: market', { exact: true })).toBeVisible()
  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(introScene)
  }).toBe(false)

  const marketScene = await canvas.screenshot()
  await page.getByRole('button', { name: 'Focus parent intro' }).click()
  await expect(page.getByText('Current: intro', { exact: true })).toBeVisible()
  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(marketScene)
  }).toBe(false)

  const returnedIntroScene = await canvas.screenshot()
  await cameraTarget.selectOption('solution')
  await expect(page.getByText('Current: solution', { exact: true })).toBeVisible()
  await expect.poll(async () => {
    const current = await canvas.screenshot()
    return current.equals(returnedIntroScene)
  }).toBe(false)
})
