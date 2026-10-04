import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

import MindPptCanvasService, {
  serviceName as canvasServiceName,
  type ExtensionNode,
} from 'dsh-mindppt-canvas-excalidraw'
import MindPptParserService, {
  type SlideNode,
} from 'dsh-mindppt-code-parser'
import MindPptLatexPlugin, { renderLatex } from '../src/index.ts'

const SOURCE = [
  'mindppt',
  '',
  'slide math {',
  '  # Euler identity',
  '',
  '  ```latex',
  '  e^{i\\pi} + 1 = 0',
  '  ```',
  '}',
  '',
].join('\n')

const EXCALIDRAW_HELVETICA_FONT_FAMILY = 2

describe('dsh-mindppt-latex', () => {
  it('pins every formula text primitive to Excalidraw Helvetica', () => {
    const element: ExtensionNode = {
      kind: 'extension',
      type: 'latex',
      id: 'slide:math/extension:0',
      raw: 'e^{i\\pi} + 1 = 0',
      x: 40,
      y: 100,
      width: 640,
      height: 140,
      sourceRange: { start: 0, end: 1 },
    }
    const slide: SlideNode = {
      id: 'math',
      x: 100,
      y: 200,
      width: 900,
      height: 500,
      elements: [element],
      sourceRange: { start: 0, end: 1 },
    }

    const scene = renderLatex({ slide, element })

    for (const segment of ['base', 'superscript', 'suffix']) {
      expect(scene.find(
        ({ id }) => id === element.id + '/latex/' + segment,
      )).toEqual(expect.objectContaining({
        label: expect.objectContaining({
          fontFamily: EXCALIDRAW_HELVETICA_FONT_FAMILY,
        }),
      }))
    }
  })

  it('loads and unloads specialized projection without recompiling', async () => {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)

    let parser!: MindPptParserService
    let canvas!: MindPptCanvasService
    const compiled = vi.fn()

    await ctx.plugin({
      name: 'mindppt-latex-test-driver',
      inject: ['mindpptParser', canvasServiceName],
      apply(child: Context) {
        parser = child.mindpptParser
        canvas = child.mindpptCanvas
        child.on('mindppt/compiled', compiled)
      },
    })

    const structure = parser.compile(SOURCE)
    const extension = structure.slides[0]!.elements.find(
      (element) => element.kind === 'extension',
    )!
    const fallbackId = extension.id + '/box'

    expect(compiled).toHaveBeenCalledTimes(1)
    expect(canvas.scene.some(({ id }) => id === fallbackId)).toBe(true)
    expect(canvas.extensionRendererTypes).toEqual([])

    const firstFiber = await ctx.plugin(MindPptLatexPlugin)

    expect(compiled).toHaveBeenCalledTimes(1)
    expect(parser.structure).toBe(structure)
    expect(canvas.extensionRendererTypes).toEqual(['latex'])
    expect(canvas.scene.some(({ id }) => id === fallbackId)).toBe(false)

    const base = canvas.scene.find(
      ({ id }) => id === extension.id + '/latex/base',
    )
    const superscript = canvas.scene.find(
      ({ id }) => id === extension.id + '/latex/superscript',
    )
    const suffix = canvas.scene.find(
      ({ id }) => id === extension.id + '/latex/suffix',
    )

    expect(base).toEqual(expect.objectContaining({
      type: 'rectangle',
      label: expect.objectContaining({ text: 'e' }),
    }))
    expect(superscript).toEqual(expect.objectContaining({
      type: 'rectangle',
      label: expect.objectContaining({ text: 'iπ' }),
    }))
    expect(suffix).toEqual(expect.objectContaining({
      type: 'rectangle',
      label: expect.objectContaining({ text: '+ 1 = 0' }),
    }))
    expect((superscript as { y: number }).y).toBeLessThan(
      (base as { y: number }).y,
    )

    await firstFiber.dispose()

    expect(compiled).toHaveBeenCalledTimes(1)
    expect(parser.structure).toBe(structure)
    expect(canvas.extensionRendererTypes).toEqual([])
    expect(canvas.scene.some(({ id }) => id === fallbackId)).toBe(true)

    const secondFiber = await ctx.plugin(MindPptLatexPlugin)
    expect(canvas.extensionRendererTypes).toEqual(['latex'])
    expect(canvas.scene.some(
      ({ id }) => id === extension.id + '/latex/superscript',
    )).toBe(true)
    await secondFiber.dispose()
  })
})
