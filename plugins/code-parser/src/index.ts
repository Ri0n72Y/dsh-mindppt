import { Service, type Context } from '@deepseek-ai/cordis'

import { compileSource } from './compiler.ts'
import { MindPptCompileError } from './errors.ts'
import type { MindPptStructure } from './types.ts'

export { MindPptCompileError }
export type {
  ContentNode,
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
  structure: MindPptStructure | undefined

  constructor(ctx: Context) {
    super(ctx, serviceName)
  }

  compile(source: string): MindPptStructure {
    const structure = compileSource(source)
    this.structure = structure
    this.ctx.emit('mindppt/compiled', structure)
    return structure
  }
}
