import { Service, type Context } from '@deepseek-ai/cordis'

import { compileSource } from './compiler.ts'
import { MindPptCompileError } from './errors.ts'
import type {
  MindPptDiagnostic,
  MindPptStructure,
} from './types.ts'

export { MindPptCompileError }
export type {
  ContentNode,
  MindPptDiagnostic,
  MindPptStructure,
  SlideNode,
  SourceRange,
  TextNode,
  TreeEdge,
  TreeSpec,
} from './types.ts'

export const serviceName = 'mindpptParser' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptParser: MindPptParserService
  }

  interface Events {
    'mindppt/compiled': (structure: MindPptStructure) => void
  }
}

export default class MindPptParserService extends Service {
  source = ''
  diagnostics: MindPptDiagnostic[] = []
  structure: MindPptStructure | undefined

  constructor(ctx: Context) {
    super(ctx, serviceName)
  }

  compile(source: string): MindPptStructure {
    this.source = source

    try {
      const structure = compileSource(source)
      this.structure = structure
      this.diagnostics = []
      this.ctx.emit('mindppt/compiled', structure)
      return structure
    } catch (error) {
      this.diagnostics = [toDiagnostic(error)]
      throw error
    }
  }
}

function toDiagnostic(error: unknown): MindPptDiagnostic {
  if (error instanceof MindPptCompileError) {
    return {
      severity: 'error',
      message: error.message,
      ...(error.sourceRange ? { sourceRange: error.sourceRange } : {}),
    }
  }

  return {
    severity: 'error',
    message: error instanceof Error ? error.message : String(error),
  }
}
