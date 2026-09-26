import { Service, type Context } from '@deepseek-ai/cordis'

import { compileHelloWorld, MindPptSyntaxError } from './compiler.ts'
import type { MindPptStructure } from './types.ts'

export { MindPptSyntaxError }
export type { MindPptStructure, SlideNode, SourceRange, TextNode } from './types.ts'

export const serviceName = 'mindpptParser' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptParser: MindPptParserService
  }

  interface Events {
    'mindppt/compiled': (structure: MindPptStructure) => void
  }
}

/**
 * Cordis-owned compiler service.
 *
 * The hello-world slice keeps the public boundary we will retain as the real
 * tokenizer, parser, resolver, validator, and layout stages are added behind it.
 */
export default class MindPptParserService extends Service {
  structure: MindPptStructure | undefined

  constructor(ctx: Context) {
    super(ctx, serviceName)
  }

  compile(source: string): MindPptStructure {
    const structure = compileHelloWorld(source)
    this.structure = structure
    this.ctx.emit('mindppt/compiled', structure)
    return structure
  }
}
