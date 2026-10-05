import { Context } from '@deepseek-ai/cordis'
import MindPptCanvasService from 'dsh-mindppt-canvas-excalidraw'
import MindPptEditorService from 'dsh-mindppt-code-editor'
import MindPptLatexPlugin from 'dsh-mindppt-latex'
import MindPptParserService, {
  type MindPptDiagnostic,
  type MindPptStructure,
} from 'dsh-mindppt-code-parser'

export interface RuntimeView {
  source: string
  diagnostics: readonly MindPptDiagnostic[]
  structureCurrent: boolean
  structure: MindPptStructure | undefined
  rendererTypes: readonly string[]
}

export class MindPptDocumentRuntime {
  private compileAttempts = 0

  private constructor(
    private readonly editor: MindPptEditorService,
    private readonly parser: MindPptParserService,
    private readonly canvas: MindPptCanvasService,
  ) {}

  static async create(source: string): Promise<MindPptDocumentRuntime> {
    const ctx = new Context()
    await ctx.plugin(MindPptParserService)
    await ctx.plugin(MindPptCanvasService)
    await ctx.plugin(MindPptEditorService)
    await ctx.plugin(MindPptLatexPlugin)
    let editor: MindPptEditorService | undefined
    let parser: MindPptParserService | undefined
    let canvas: MindPptCanvasService | undefined
    await ctx.plugin({
      name: 'dsh-mindppt-runtime-capture',
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
    const document = new MindPptDocumentRuntime(editor, parser, canvas)
    document.applySource(source)
    return document
  }

  applySource(source: string): boolean {
    this.compileAttempts += 1
    return this.editor.setSource(source)
  }

  get attempts(): number {
    return this.compileAttempts
  }

  get view(): RuntimeView {
    return {
      source: this.editor.source,
      diagnostics: [...this.parser.diagnostics],
      structureCurrent: this.parser.structure !== undefined
        && !this.parser.diagnostics.some(
          diagnostic => diagnostic.severity === 'error',
        ),
      structure: this.parser.structure,
      rendererTypes: this.canvas.extensionRendererTypes,
    }
  }
}
