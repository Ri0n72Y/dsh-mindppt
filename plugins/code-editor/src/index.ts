import { Service, type Context } from '@deepseek-ai/cordis'
import {
  MindPptCompileError,
  type MindPptParserService,
} from 'dsh-mindppt-code-parser'

export const serviceName = 'mindpptEditor' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptEditor: MindPptEditorService
    mindpptParser: MindPptParserService
  }
}

export default class MindPptEditorService extends Service {
  static inject = ['mindpptParser']

  source = ''

  constructor(ctx: Context) {
    super(ctx, serviceName)
  }

  setSource(source: string): boolean {
    this.source = source

    try {
      this.ctx.mindpptParser.compile(source)
      return true
    } catch (error) {
      if (error instanceof MindPptCompileError) return false
      throw error
    }
  }
}
