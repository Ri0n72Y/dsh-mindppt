export class MindPptSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MindPptSyntaxError'
  }
}
