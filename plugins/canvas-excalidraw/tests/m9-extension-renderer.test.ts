import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import MindPptParserService from 'dsh-mindppt-code-parser'
import MindPptCanvasService, {
  serviceName,
  type ExtensionRenderer,
} from '../src/index.ts'

const SOURCE = [
  'mindppt',
  '',
  'slide demo {',
  '  # Demo',
  '',
  '  ```demo',
  '  alpha',
  '  ```',
  '}',
  '',
].join('\n')

async function createRuntime() {
  const ctx = new Context()
  await ctx.plugin(MindPptParserService)
  await ctx.plugin(MindPptCanvasService)

  let parser!: MindPptParserService
  let canvas!: MindPptCanvasService

  await ctx.plugin({
    name: 'mindppt-m9-canvas-test-driver',
    inject: ['mindpptParser', serviceName],
    apply(child: Context) {
      parser = child.mindpptParser
      canvas = child.mindpptCanvas
    },
  })

  return { ctx, parser, canvas }
}

const renderer: ExtensionRenderer = ({ slide, element }) => [{
  type: 'rectangle',
  id: element.id + '/specialized',
  x: slide.x + element.x,
  y: slide.y + element.y,
  width: element.width,
  height: element.height,
  backgroundColor: '#ffffff',
  strokeColor: '#111827',
  fillStyle: 'solid',
  roughness: 0,
  label: {
    text: 'special:' + element.raw.trim(),
    fontSize: 20,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
}]

describe('M9 extension renderer capability', () => {
  it('reprojects one semantic structure across renderer load and unload', async () => {
    const { ctx, parser, canvas } = await createRuntime()
    const structure = parser.compile(SOURCE)
    const extension = structure.slides[0]!.elements.find(
      (element) => element.kind === 'extension',
    )!
    const semanticSnapshot = { ...extension }

    expect(canvas.extensionRendererTypes).toEqual([])
    expect(canvas.scene.some(
      (element) => element.id === extension.id + '/box',
    )).toBe(true)

    const firstFiber = await ctx.plugin({
      name: 'mindppt-m9-test-renderer',
      inject: [serviceName],
      apply(child: Context) {
        child.effect(() =>
          child.mindpptCanvas.registerExtensionRenderer('demo', renderer),
        )
      },
    })

    expect(parser.structure).toBe(structure)
    expect(extension).toEqual(semanticSnapshot)
    expect(canvas.extensionRendererTypes).toEqual(['demo'])
    expect(canvas.scene.some(
      (element) => element.id === extension.id + '/specialized',
    )).toBe(true)

    expect(() =>
      canvas.registerExtensionRenderer('demo', () => []),
    ).toThrow('Extension renderer already registered: demo')
    expect(canvas.scene.some(
      (element) => element.id === extension.id + '/specialized',
    )).toBe(true)

    const firstIds = canvas.scene.map(({ id }) => id).filter(Boolean)
    await firstFiber.dispose()

    expect(parser.structure).toBe(structure)
    expect(extension).toEqual(semanticSnapshot)
    expect(canvas.extensionRendererTypes).toEqual([])
    expect(canvas.scene.some(
      (element) => element.id === extension.id + '/box',
    )).toBe(true)

    const secondFiber = await ctx.plugin({
      name: 'mindppt-m9-test-renderer-reload',
      inject: [serviceName],
      apply(child: Context) {
        child.effect(() =>
          child.mindpptCanvas.registerExtensionRenderer('demo', renderer),
        )
      },
    })

    expect(canvas.scene.map(({ id }) => id).filter(Boolean)).toEqual(firstIds)
    await secondFiber.dispose()
  })

  it('keeps fallback for unrelated, empty, and throwing renderers', async () => {
    const { canvas, parser } = await createRuntime()
    const structure = parser.compile(SOURCE)
    const extension = structure.slides[0]!.elements.find(
      (element) => element.kind === 'extension',
    )!
    const fallbackId = extension.id + '/box'

    const disposeOther = canvas.registerExtensionRenderer('other', renderer)
    expect(canvas.scene.some(({ id }) => id === fallbackId)).toBe(true)
    disposeOther()

    const disposeEmpty = canvas.registerExtensionRenderer('demo', () => [])
    expect(canvas.scene.some(({ id }) => id === fallbackId)).toBe(true)
    disposeEmpty()

    const disposeThrowing = canvas.registerExtensionRenderer('demo', () => {
      throw new Error('renderer failed')
    })
    expect(canvas.scene.some(({ id }) => id === fallbackId)).toBe(true)
    disposeThrowing()
  })
})
