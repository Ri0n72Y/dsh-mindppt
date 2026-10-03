import { expect, test } from '@playwright/test'

const LATIN_SOURCE = [
  'mindppt',
  '',
  'slide fit {',
  '  layout title-content',
  '',
  '  # Geometry contract',
  '',
  '  This paragraph intentionally uses enough ordinary words to wrap across several lines while remaining inside the title content semantic region.',
  '',
  '  - First list item carries enough detail to wrap inside the semantic box.',
  '  - Second list item also wraps without asking Excalidraw to grow the container.',
  '  - Third list item confirms the compiler owns the final text-box geometry.',
  '}',
  '',
].join('\n')

const CJK_PARAGRAPH =
  '中文段落用于验证编译器拥有文本几何并覆盖实际换行边界'.repeat(4)
const WIDE_ITEM =
  '宽字符列表项用于验证中文与全角字符不会扩大容器ＷＭ🙂'.repeat(2)
const CJK_SOURCE = titleContentSource(
  CJK_PARAGRAPH,
  [WIDE_ITEM, WIDE_ITEM, WIDE_ITEM],
)

test('real Excalidraw conversion preserves Latin and wide-glyph semantic boxes', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')

  const geometry = await page.evaluate(async ({ latin, cjk }) => {
    const { mountAssetBrowserHarness } = await import('/src/asset-browser-harness.tsx')

    const read = async (source: string) => {
      const container = document.createElement('div')
      container.style.width = '1000px'
      container.style.height = '760px'
      document.body.append(container)

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

      const result = {
        text: pick('slide:fit/text:0/box'),
        list: pick('slide:fit/list:0/box'),
      }
      container.remove()
      return result
    }

    return {
      latin: await read(latin),
      cjk: await read(cjk),
    }
  }, { latin: LATIN_SOURCE, cjk: CJK_SOURCE })

  expect(geometry.latin).toEqual({
    text: { x: 128, y: 184, width: 1024, height: 100 },
    list: { x: 128, y: 304, width: 1024, height: 190 },
  })
  expect(geometry.cjk).toEqual({
    text: { x: 128, y: 184, width: 1024, height: 100 },
    list: { x: 128, y: 304, width: 1024, height: 280 },
  })
})

test('CJK overflow keeps the mounted last-good elements files and camera', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const { mountAssetBrowserHarness } = await import('/src/asset-browser-harness.tsx')
    const container = document.createElement('div')
    container.style.width = '1000px'
    container.style.height = '760px'
    document.body.append(container)

    const fits = '界'.repeat(630)
    const validSource = [
      'mindppt',
      '',
      'slide fit {',
      '  layout title-content',
      '',
      '  # Boundary',
      '',
      '  ' + fits,
      '}',
      '',
    ].join('\n')
    const invalidSource = validSource.replace(fits, fits + '界')
    const harness = await mountAssetBrowserHarness(
      container,
      validSource,
      { documentPath: 'examples/fit.mindppt', files: {} },
    )

    harness.runtime.focusSlide('fit')
    const before = harness.runtime.getSnapshot()
    harness.runtime.setSource(invalidSource)
    const after = harness.runtime.getSnapshot()
    const diagnostic = after.diagnostics[0]

    return {
      elementsSame: JSON.stringify(after.elements) === JSON.stringify(before.elements),
      filesSame: JSON.stringify(after.files) === JSON.stringify(before.files),
      cameraSame: JSON.stringify(after.camera) === JSON.stringify(before.camera),
      message: diagnostic?.message,
      block: diagnostic?.sourceRange
        ? invalidSource
            .slice(diagnostic.sourceRange.start, diagnostic.sourceRange.end)
            .trim()
        : undefined,
      expectedBlock: fits + '界',
    }
  })

  expect(result.elementsSame).toBe(true)
  expect(result.filesSame).toBe(true)
  expect(result.cameraSame).toBe(true)
  expect(result.message).toBe(
    'Content does not fit in the available semantic layout region',
  )
  expect(result.block).toBe(result.expectedBlock)
})

function titleContentSource(paragraph: string, items: string[]): string {
  return [
    'mindppt',
    '',
    'slide fit {',
    '  layout title-content',
    '',
    '  # Geometry contract',
    '',
    '  ' + paragraph,
    '',
    ...items.map((item) => '  - ' + item),
    '}',
    '',
  ].join('\n')
}
