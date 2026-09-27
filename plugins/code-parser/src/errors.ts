export class MindPptCompileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MindPptCompileError'
  }
}
