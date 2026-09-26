import { MindPptSyntaxError } from './errors.ts'
import type { Token } from './tokenizer.ts'
import type { SourceRange } from './types.ts'

export interface ParsedSlide {
  id: string
  title: string
  range: SourceRange
  titleRange: SourceRange
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
    this.expect('marker')

    const slides: ParsedSlide[] = []
    let tree: ParsedTree | undefined

    while (this.current()) {
      const token = this.current()
      if (token?.kind === 'tree-start') {
        if (tree) this.fail('M1 supports one primary tree')
        tree = this.parseTree()
        continue
      }

      if (token?.kind === 'slide-start') {
        slides.push(this.parseSlide())
        continue
      }

      this.fail(`Unexpected document statement: ${describe(token)}`)
    }

    return tree ? { slides, tree } : { slides }
  }

  private parseTree(): ParsedTree {
    const start = this.expect('tree-start')
    if (start.direction !== 'LR') {
      this.fail('M1 supports tree direction LR only')
    }

    const edges: ParsedTreeEdge[] = []
    while (this.current()?.kind !== 'block-end') {
      const edge = this.expect('edge')
      edges.push({ from: edge.from, to: edge.to, range: edge.range })
    }

    const end = this.expect('block-end')
    if (edges.length === 0) this.fail('Tree must contain at least one edge')

    return {
      direction: 'LR',
      edges,
      range: { start: start.range.start, end: end.range.end },
    }
  }

  private parseSlide(): ParsedSlide {
    const start = this.expect('slide-start')
    let title: Extract<Token, { kind: 'heading' }> | undefined

    while (this.current()?.kind !== 'block-end') {
      const token = this.current()

      if (token?.kind === 'heading') {
        if (title) this.fail('M1 supports one # heading per slide')
        title = token
        this.index += 1
        continue
      }

      if (token?.kind === 'fence') {
        this.fail('Fenced slide content is introduced in M2')
      }

      this.fail(`Unsupported M1 slide content: ${describe(token)}`)
    }

    const end = this.expect('block-end')
    if (!title) this.fail(`Slide "${start.id}" requires one # heading`)

    return {
      id: start.id,
      title: title.text,
      range: { start: start.range.start, end: end.range.end },
      titleRange: title.range,
    }
  }

  private current(): Token | undefined {
    return this.tokens[this.index]
  }

  private expect<K extends Token['kind']>(
    kind: K,
  ): Extract<Token, { kind: K }> {
    const token = this.current()
    if (token?.kind !== kind) {
      this.fail(`Expected ${kind}, received ${describe(token)}`)
    }

    this.index += 1
    return token as Extract<Token, { kind: K }>
  }

  private fail(message: string): never {
    throw new MindPptSyntaxError(message)
  }
}

function describe(token: Token | undefined): string {
  if (!token) return 'end of source'
  if (token.kind === 'unknown') return token.text
  return token.kind
}
