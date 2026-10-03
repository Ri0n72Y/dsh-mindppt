import { test } from '@playwright/test'

test('probe Excalidraw 0.18 font advances', async ({ page }) => {
  await page.goto('/')

  const metrics = await page.evaluate(async () => {
    await document.fonts.ready
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2d context unavailable')

    const fontSize = 1000
    context.font =
      fontSize + 'px Excalifont, Xiaolai, "Segoe UI Emoji", sans-serif'

    const widths = Array.from({ length: 95 }, (_, index) => {
      const character = String.fromCodePoint(index + 32)
      return [character, context.measureText(character).width / fontSize] as const
    })

    let maxPairDelta = { pair: '', value: Number.NEGATIVE_INFINITY }
    for (const [left, leftWidth] of widths) {
      for (const [right, rightWidth] of widths) {
        const pair = left + right
        const delta =
          context.measureText(pair).width / fontSize
          - leftWidth
          - rightWidth
        if (delta > maxPairDelta.value) {
          maxPairDelta = { pair, value: delta }
        }
      }
    }

    return {
      excalifontLoaded: document.fonts.check(fontSize + 'px Excalifont'),
      widths: widths
        .sort((a, b) => b[1] - a[1])
        .map(([character, width]) => [character, Number(width.toFixed(6))]),
      maxPairDelta: {
        pair: maxPairDelta.pair,
        value: Number(maxPairDelta.value.toFixed(6)),
      },
      fallback: ['界', '中', 'Ｗ', 'Ｍ', '🙂', '😀', '🚀'].map((character) => [
        character,
        Number((context.measureText(character).width / fontSize).toFixed(6)),
      ]),
    }
  })

  console.log('MINDPPT_FONT_METRICS=' + JSON.stringify(metrics))
})
