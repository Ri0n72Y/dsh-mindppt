import { Context } from '@deepseek-ai/cordis'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

import MindPptCanvasService from 'dsh-mindppt-canvas-excalidraw'
import MindPptEditorService from 'dsh-mindppt-code-editor'
import MindPptParserService, {
  type MindPptDiagnostic,
} from 'dsh-mindppt-code-parser'

export type CompiledElements = ReturnType<typeof convertToExcalidrawElements>

export interface PlaygroundSnapshot {
  source: string
  diagnostics: readonly MindPptDiagnostic[]
  elements: CompiledElements
}

export interface PlaygroundRuntime {
  getSnapshot: () => PlaygroundSnapshot
  subscribe: (listener: () => void) => () => void
  setSource: (source: string) => void
}

export async function createPlaygroundRuntime(
  initialSource: string,
): Promise<PlaygroundRuntime> {
  const ctx = new Context()

  await ctx.plugin(MindPptParserService)
  await ctx.plugin(MindPptCanvasService)
  await ctx.plugin(MindPptEditorService)

  let editor: MindPptEditorService | undefined
  let parser: MindPptParserService | undefined
  let canvas: MindPptCanvasService | undefined

  await ctx.plugin({
    name: 'mindppt-playground-driver',
    inject: ['mindpptEditor', 'mindpptParser', 'mindpptCanvas'],
    apply(runtime: Context) {
      editor = runtime.mindpptEditor
      parser = runtime.mindpptParser
      canvas = runtime.mindpptCanvas
    },
  })

  if (!editor || !parser || !canvas) {
    throw new Error('MindPPT runtime services were not initialized')
  }

  const listeners = new Set<() => void>()
  let snapshot: PlaygroundSnapshot = {
    source: '',
    diagnostics: [],
    elements: [],
  }

  const setSource = (source: string) => {
    const compiled = editor.setSource(source)

    snapshot = {
      source: editor.source,
      diagnostics: [...parser.diagnostics],
      elements: compiled
        ? convertToExcalidrawElements(canvas.scene, { regenerateIds: false })
        : snapshot.elements,
    }

    for (const listener of listeners) listener()
  }

  setSource(initialSource)

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setSource,
  }
}
