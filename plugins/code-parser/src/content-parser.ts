import { MindPptCompileError } from './errors.ts'
import type { Token } from './tokenizer.ts'
import type { SourceRange } from './types.ts'

export type ParsedContent =
  | {
      kind: 'title' | 'subtitle' | 'text'
      text: string
      range: SourceRange
    }
  | {
      kind: 'list'
      ordered: boolean
      items: string[]
      range: SourceRange
    }
  | {
      kind: 'extension'
      type: string
      raw: string
      range: SourceRange
    }

export function parseSlideContent(
  tokens: Token[],
  slideId: string,
): ParsedContent[] {
  return new ContentParser(tokens, slideId).parse()
}

class ContentParser {
  private index = 0
  private titles = 0

  constructor(
    private readonly tokens: Token[],
    private readonly slideId: string,
  ) {}

  parse(): ParsedContent[] {
    const content: ParsedContent[] = []

    while (this.current()) {
      this.skipBlanks()
      const token = this.current()
      if (!token) break

      if (token.kind === 'heading') {
        const kind = token.level === 1 ? 'title' : 'subtitle'
        if (kind === 'title' && ++this.titles > 1) {
          this.fail('supports one # heading')
        }
        content.push({ kind, text: token.text, range: token.range })
        this.index += 1
        continue
      }

      if (token.kind === 'text') {
        content.push(this.parseParagraph())
        continue
      }

      if (token.kind === 'list-item') {
        content.push(this.parseList(token.ordered))
        continue
      }

      if (token.kind === 'fence') {
        content.push({
          kind: 'extension',
          type: token.type,
          raw: token.raw,
          range: token.range,
        })
        this.index += 1
        continue
      }

      this.fail(`contains unsupported ${token.kind}`)
    }

    if (this.titles === 0) this.fail('requires one # heading')
    return content
  }

  private parseParagraph(): ParsedContent {
    const first = this.expect('text')
    const lines = [first.text]
    let end = first.range.end

    while (this.current()?.kind === 'text') {
      const line = this.expect('text')
      lines.push(line.text)
      end = line.range.end
    }

    return {
      kind: 'text',
      text: lines.join(' '),
      range: { start: first.range.start, end },
    }
  }

  private parseList(ordered: boolean): ParsedContent {
    const first = this.expect('list-item')
    const items = [first.text]
    let end = first.range.end

    while (true) {
      const token = this.current()
      if (token?.kind !== 'list-item' || token.ordered !== ordered) break

      const item = this.expect('list-item')
      items.push(item.text)
      end = item.range.end
    }

    return {
      kind: 'list',
      ordered,
      items,
      range: { start: first.range.start, end },
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
      this.fail(`expected ${kind}`)
    }

    this.index += 1
    return token as Extract<Token, { kind: K }>
  }

  private fail(message: string): never {
    throw new MindPptCompileError(`Slide "${this.slideId}" ${message}`)
  }
}
