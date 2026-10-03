import { expect, test } from '@playwright/test'

const WHITESPACE_SEGMENT = 'word\tword        '

test('tabs and repeated spaces preserve converted geometry and overflow last-good', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')

  const validSource = bodySource(WHITESPACE_SEGMENT.repeat(45).trim())
  const invalidBody = WHITESPACE_SEGMENT.repeat(46).trim()
  const invalidSource = bodySource(invalidBody)

  const result = await page.evaluate(async ({ validSource, invalidSource }) => {
    const { mountAssetBrowserHarness } = await import(
      '/src/asset-browser-harness.tsx'
    )
    const container = document.createElement('div')
    container.style.width = '1000px'
    container.style.height = '760px'
    document.body.append(container)

    const harness = await mountAssetBrowserHarness(
      container,
      validSource,
      { documentPath: 'examples/fit.mindppt', files: {} },
    )
    harness.runtime.focusSlide('fit')
    const before = harness.runtime.getSnapshot()
    const box = before.elements.find(
      (element) => element.id === 'slide:fit/text:0/box',
    )

    harness.runtime.setSource(invalidSource)
    const after = harness.runtime.getSnapshot()
    const diagnostic = after.diagnostics[0]

    return {
      box: box && {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      elementsSame: JSON.stringify(after.elements) === JSON.stringify(before.elements),
      filesSame: JSON.stringify(after.files) === JSON.stringify(before.files),
      cameraSame: JSON.stringify(after.camera) === JSON.stringify(before.camera),
      message: diagnostic?.message,
      block: diagnostic?.sourceRange
        ? invalidSource
            .slice(diagnostic.sourceRange.start, diagnostic.sourceRange.end)
            .trim()
        : undefined,
    }
  }, { validSource, invalidSource })

  expect(result.box).toEqual({
    x: 128,
    y: 184,
    width: 1024,
    height: 460,
  })
  expect(result.elementsSame).toBe(true)
  expect(result.filesSame).toBe(true)
  expect(result.cameraSame).toBe(true)
  expect(result.message).toBe(
    'Content does not fit in the available semantic layout region',
  )
  expect(result.block).toBe(invalidBody)
})

test('extension fallback converts as a bound label and overflow preserves last-good', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')

  const validSource = extensionSource('W'.repeat(200))
  const invalidBody = 'W'.repeat(369)
  const invalidSource = extensionSource(invalidBody)

  const result = await page.evaluate(async ({ validSource, invalidSource }) => {
    const { mountAssetBrowserHarness } = await import(
      '/src/asset-browser-harness.tsx'
    )
    const container = document.createElement('div')
    container.style.width = '1000px'
    container.style.height = '760px'
    document.body.append(container)

    const harness = await mountAssetBrowserHarness(
      container,
      validSource,
      { documentPath: 'examples/fit.mindppt', files: {} },
    )
    harness.runtime.focusSlide('fit')
    const before = harness.runtime.getSnapshot()
    const boxId = 'slide:fit/left/extension:0/box'
    const box = before.elements.find((element) => element.id === boxId)
    const boundLabel = before.elements.find(
      (element) => element.type === 'text' && element.containerId === boxId,
    )

    harness.runtime.setSource(invalidSource)
    const after = harness.runtime.getSnapshot()
    const diagnostic = after.diagnostics[0]

    return {
      box: box && {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      boundLabel: Boolean(boundLabel),
      standaloneFallback: before.elements.some(
        (element) => element.id === 'slide:fit/left/extension:0/text',
      ),
      elementsSame: JSON.stringify(after.elements) === JSON.stringify(before.elements),
      filesSame: JSON.stringify(after.files) === JSON.stringify(before.files),
      cameraSame: JSON.stringify(after.camera) === JSON.stringify(before.camera),
      message: diagnostic?.message,
      block: diagnostic?.sourceRange
        ? invalidSource.slice(
            diagnostic.sourceRange.start,
            diagnostic.sourceRange.end,
          )
        : undefined,
    }
  }, { validSource, invalidSource })

  expect(result.box).toEqual({
    x: 96,
    y: 176,
    width: 520,
    height: 285,
  })
  expect(result.boundLabel).toBe(true)
  expect(result.standaloneFallback).toBe(false)
  expect(result.elementsSame).toBe(true)
  expect(result.filesSame).toBe(true)
  expect(result.cameraSame).toBe(true)
  expect(result.message).toBe(
    'Content does not fit in the available semantic layout region',
  )
  expect(result.block).toContain(invalidBody)
})

function bodySource(body: string): string {
  return [
    'mindppt',
    '',
    'slide fit {',
    '  layout title-content',
    '',
    '  # Boundary',
    '',
    '  ' + body,
    '}',
    '',
  ].join('\n')
}

function extensionSource(body: string): string {
  return [
    'mindppt',
    '',
    'slide fit {',
    '  layout two-column',
    '',
    '  # Extension boundary',
    '',
    '  left {',
    '    ```demo',
    body,
    '    ```',
    '  }',
    '}',
    '',
  ].join('\n')
}
