import { parseSlideContent, type ParsedContent } from './content-parser.ts'
import { MindPptCompileError } from './errors.ts'
import type { Token } from './tokenizer.ts'
import type { SourceRange } from './types.ts'

export interface ParsedSlide {
  id: string
  content: ParsedContent[]
  range: SourceRange
}

export interface ParsedTreeEdge {
  from: string
  to: string
  range: SourceRange
}

export interface ParsedTree {
  direction: 'LR'
  edges: ParsedTreeEdge[]
  range: SourceRange
}

export interface ParsedDocument {
  slides: ParsedSlide[]
  tree?: ParsedTree
}

export function parse(tokens: Token[]): ParsedDocument {
  return new Parser(tokens).parseDocument()
}

class Parser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  parseDocument(): ParsedDocument {
    this.skipBlanks()
    this.expect('marker')

    const slides: ParsedSlide[] = []
    let tree: ParsedTree | undefined

    while (this.current()) {
      this.skipBlanks()
      const token = this.current()
      if (!token) break

      if (token.kind === 'tree-start') {
        if (tree) this.fail('M2 supports one primary tree')
        tree = this.parseTree()
        continue
      }

      if (token.kind === 'slide-start') {
        slides.push(this.parseSlide())
        continue
      }

      this.fail(`Unexpected document statement: ${token.kind}`)
    }

    return tree ? { slides, tree } : { slides }
  }

  private parseTree(): ParsedTree {
    const start = this.expect('tree-start')
    if (start.direction !== 'LR') {
      this.fail('M2 supports tree direction LR only', start.range)
    }

    const edges: ParsedTreeEdge[] = []
    while (true) {
      this.skipBlanks()
      if (this.current()?.kind === 'block-end') break
      const edge = this.expect('edge')
      edges.push({ from: edge.from, to: edge.to, range: edge.range })
    }

    const end = this.expect('block-end')
    if (edges.length === 0) {
      this.fail(
        'Tree must contain at least one edge',
        { start: start.range.start, end: end.range.end },
      )
    }

    return {
      direction: 'LR',
      edges,
      range: { start: start.range.start, end: end.range.end },
    }
  }

  private parseSlide(): ParsedSlide {
    const start = this.expect('slide-start')
    const body: Token[] = []

    while (this.current() && this.current()?.kind !== 'block-end') {
      const token = this.current()
      if (token) body.push(token)
      this.index += 1
    }

    const end = this.expect('block-end')
    return {
      id: start.id,
      content: parseSlideContent(body, start.id),
      range: { start: start.range.start, end: end.range.end },
    }
  }

  private skipBlanks(): void {
    while (this.current()?.kind === 'blank') this.index += 1
  }

  private current(): Token | undefined {
    return this.tokens[this.index]
  }

  private expect<K extends Token['kind']>(
    kind: K,
  ): Extract<Token, { kind: K }> {
    const token = this.current()
    if (token?.kind !== kind) {
      this.fail(`Expected ${kind}, received ${token?.kind ?? 'end of source'}`)
    }

    this.index += 1
    return token as Extract<Token, { kind: K }>
  }

  private fail(message: string, sourceRange?: SourceRange): never {
    const current = this.current()?.range
    const previous = this.tokens[this.index - 1]?.range
    const resolvedRange = sourceRange ?? current ?? (
      previous
        ? { start: previous.end, end: previous.end }
        : undefined
    )

    throw new MindPptCompileError(message, resolvedRange)
  }
}
