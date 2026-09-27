import { Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

import MindPptCanvasService, {
  type ExcalidrawScene,
} from 'dsh-mindppt-canvas-excalidraw'
import MindPptParserService from 'dsh-mindppt-code-parser'

export type CompiledElements = ReturnType<typeof convertToExcalidrawElements>

export async function compileMindPpt(source: string): Promise<CompiledElements> {
  const ctx = new Context()

  await ctx.plugin(MindPptParserService)
  await ctx.plugin(MindPptCanvasService)

  let scene: ExcalidrawScene | undefined

  await ctx.plugin({
    name: 'mindppt-playground-driver',
    inject: ['mindpptParser', 'mindpptCanvas'],
    apply(runtime: Context) {
      runtime.mindpptParser.compile(source)
      scene = runtime.mindpptCanvas.scene
    },
  })

  if (!scene) {
    throw new Error('MindPPT renderer did not produce a scene')
  }

  const elements = convertToExcalidrawElements(scene, {
    regenerateIds: false,
  })

  debugConvertedElements(elements)

  return elements
}

function debugConvertedElements(elements: CompiledElements): void {
  if (!debugEnabled()) return

  for (const element of elements) {
    if (element.type !== 'text' || !element.id.includes('/extension:')) continue

    logTextElement('excalidraw:converted-element', element)
  }
}

interface DebugTextElement {
  id: string
  type: string
  text?: unknown
  width: number
  height: number
  fontSize?: unknown
  fontFamily?: unknown
  lineHeight?: unknown
}

export function debugMountedElements(
  elements: readonly DebugTextElement[],
): void {
  if (!debugEnabled()) return

  for (const element of elements) {
    if (element.type !== 'text' || !element.id.includes('/extension:')) continue

    logTextElement('excalidraw:mounted-scene', element)
  }
}

function logTextElement(stage: string, element: DebugTextElement): void {
  const text = typeof element.text === 'string' ? element.text : ''

  console.info('[mindppt:pipeline]', {
    stage,
    id: element.id,
    text,
    lastChar: text.at(-1) ?? '',
    fontFamily: element.fontFamily,
    width: element.width,
    height: element.height,
    fontSize: element.fontSize,
    lineHeight: element.lineHeight,
  })
}

function debugEnabled(): boolean {
  return (
    (globalThis as { __MINDPPT_DEBUG__?: boolean }).__MINDPPT_DEBUG__ === true
  )
}
