import { expect, test } from '@playwright/test'

test('M10 playground editor collapses into presentation view and restores', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')

  const editor = page.getByRole('textbox', { name: 'MindPPT source editor' })
  await expect(editor).toBeVisible()

  await page.getByRole('button', { name: 'Hide editor' }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.locator('main.playground')).toHaveClass(/playground-presentation/)
  await expect(page.locator('main.playground > .canvas-panel canvas.static')).toBeVisible()

  const path = page.getByRole('combobox', { name: 'Presentation path' })
  await expect(path).toBeVisible()
  await path.selectOption('path:short')
  await page.getByRole('button', { name: 'Next path occurrence' }).click()
  await expect(page.getByText('Current: problem', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Show editor' }).click()
  await expect(editor).toBeVisible()
  await expect(page.locator('main.playground')).not.toHaveClass(/playground-presentation/)
  await expect(page.getByText('Current: problem', { exact: true })).toBeVisible()
})
