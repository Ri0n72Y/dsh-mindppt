import { Service, type Context } from '@deepseek-ai/cordis'

export const serviceName = 'mindpptParser' as const

declare module '@deepseek-ai/cordis' {
  interface Context {
    mindpptParser: MindPptParserService
  }
}

/**
 * Cordis service boundary for the MindPPT compiler.
 *
 * Compiler behavior is added incrementally behind this service. Downstream
 * plugins depend on `ctx.mindpptParser` instead of importing parser internals.
 */
export default class MindPptParserService extends Service {
  constructor(ctx: Context) {
    super(ctx, serviceName)
  }
}
