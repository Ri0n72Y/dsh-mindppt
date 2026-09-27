import { Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

import MindPptCanvasService, {
  type ExcalidrawScene,
} from 'dsh-mindppt-canvas-excalidraw'
import MindPptParserService from 'dsh-mindppt-code-parser'

export type CompiledElements = ReturnType<typeof convertToExcalidrawElements>

export async function compileMindPpt(source: string): Promise<CompiledElements> {
  debugSource(source)

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

  debugSkeleton(scene)

  const elements = convertToExcalidrawElements(scene, {
    regenerateIds: false,
  })

  debugConvertedElements(elements)

  return elements
}

function debugSource(source: string): void {
  if (!debugEnabled()) return

  console.debug('[mindppt:pipeline]', {
    stage: 'source',
    length: source.length,
    suffix: source.slice(-80),
  })
}

function debugSkeleton(scene: ExcalidrawScene): void {
  if (!debugEnabled()) return

  for (const element of scene) {
    if (element.type !== 'text' || !element.id?.includes('/extension:')) continue

    debugText('renderer:skeleton-observed', element.text, {
      id: element.id,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      fontSize: element.fontSize,
    })
  }
}

function debugConvertedElements(elements: CompiledElements): void {
  if (!debugEnabled()) return

  for (const element of elements) {
    if (element.type !== 'text' || !element.id.includes('/extension:')) continue

    debugText('excalidraw:converted-element', element.text, {
      id: element.id,
      originalText: element.originalText,
      originalLength: element.originalText.length,
      originalLastChar: element.originalText.at(-1) ?? '',
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      fontSize: element.fontSize,
      lineHeight: element.lineHeight,
      containerId: element.containerId,
      frameId: element.frameId,
    })
  }
}

interface DebugElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  text?: unknown
  originalText?: unknown
  fontSize?: unknown
  lineHeight?: unknown
  containerId?: unknown
  frameId?: unknown
}

export function debugMountedElements(
  elements: readonly DebugElement[],
): void {
  if (!debugEnabled()) return

  for (const element of elements) {
    if (element.type !== 'text' || !element.id.includes('/extension:')) continue

    const text = typeof element.text === 'string' ? element.text : ''
    debugText('excalidraw:mounted-scene', text, {
      id: element.id,
      originalText:
        typeof element.originalText === 'string' ? element.originalText : undefined,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      fontSize: element.fontSize,
      lineHeight: element.lineHeight,
      containerId: element.containerId,
      frameId: element.frameId,
    })
  }
}

function debugText(
  stage: string,
  text: string,
  details: Record<string, unknown>,
): void {
  if (!debugEnabled()) return

  const lastChar = text.at(-1) ?? ''
  console.debug('[mindppt:pipeline]', {
    stage,
    ...details,
    text,
    length: text.length,
    lastChar,
    lastCodePoint: lastChar ? lastChar.codePointAt(0) : undefined,
    suffix: text.slice(-16),
  })
}

function debugEnabled(): boolean {
  return (
    (globalThis as { __MINDPPT_DEBUG__?: boolean }).__MINDPPT_DEBUG__ === true
  )
}
