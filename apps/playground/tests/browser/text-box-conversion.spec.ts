import { expect, test } from '@playwright/test'

test('real Excalidraw conversion preserves compiler text-box geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')

  const geometry = await page.evaluate(async () => {
    const { mountAssetBrowserHarness } = await import('/src/asset-browser-harness.tsx')
    const container = document.createElement('div')
    container.style.width = '1000px'
    container.style.height = '760px'
    document.body.append(container)

    const source = `mindppt

slide fit {
  layout title-content

  # Geometry contract

  This paragraph intentionally uses enough ordinary words to wrap across several lines while remaining inside the title content semantic region.

  - First list item carries enough detail to wrap inside the semantic box.
  - Second list item also wraps without asking Excalidraw to grow the container.
  - Third list item confirms the compiler owns the final text-box geometry.
}
`
    const harness = await mountAssetBrowserHarness(
      container,
      source,
      { documentPath: 'examples/fit.mindppt', files: {} },
    )
    const elements = harness.runtime.getSnapshot().elements
    const pick = (id: string) => {
      const element = elements.find((candidate) => candidate.id === id)
      return element && {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      }
    }

    return {
      text: pick('slide:fit/text:0/box'),
      list: pick('slide:fit/list:0/box'),
    }
  })

  expect(geometry.text).toEqual({
    x: 128,
    y: 184,
    width: 1024,
    height: 95,
  })
  expect(geometry.list).toEqual({
    x: 128,
    y: 299,
    width: 1024,
    height: 178,
  })
})
