import { expect, test } from '@playwright/test'

test('live edit updates the canvas and invalid source keeps the last-good scene', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('textbox', { name: 'MindPPT source editor' })
  const canvas = page.locator('.canvas-panel canvas.static')

  await expect(editor).toBeVisible()
  await expect(canvas).toBeVisible()
  await expect(page.getByText('Compiled', { exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const initialSource = await editor.inputValue()
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
})
