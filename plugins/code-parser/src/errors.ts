import type { SourceRange } from './types.ts'

export class MindPptCompileError extends Error {
  constructor(
    message: string,
    readonly sourceRange?: SourceRange,
  ) {
    super(message)
    this.name = 'MindPptCompileError'
  }
}
