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

  return convertToExcalidrawElements(scene, { regenerateIds: false })
}
