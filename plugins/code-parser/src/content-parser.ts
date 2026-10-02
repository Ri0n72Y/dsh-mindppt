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
      kind: 'image'
      alt: string
      src: string
      range: SourceRange
    }
  | {
      kind: 'extension'
      type: string
      raw: string
      range: SourceRange
    }

const IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)$/

export function parseSlideContent(
  tokens: Token[],
  slideId: string,
): ParsedContent[] {
  return new ContentParser(tokens, slideId).parse()
}

class ContentParser {
  private index = 0

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
        content.push({
          kind: token.level === 1 ? 'title' : 'subtitle',
          text: token.text,
          range: token.range,
        })
        this.index += 1
        continue
      }

      const image = parseImageToken(token)
      if (image) {
        content.push(image)
        this.index += 1
        continue
      }

      if (isParagraphToken(token)) {
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

      this.fail('contains unsupported ' + token.kind)
    }

    return content
  }

  private parseParagraph(): ParsedContent {
    const first = this.current()
    if (!first || !isParagraphToken(first)) this.fail('expected paragraph')

    const lines = [paragraphText(first)]
    let end = first.range.end
    this.index += 1

    while (true) {
      const token = this.current()
      if (!token || !isParagraphToken(token) || parseImageToken(token)) break
      lines.push(paragraphText(token))
      end = token.range.end
      this.index += 1
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
      this.fail('expected ' + kind)
    }

    this.index += 1
    return token as Extract<Token, { kind: K }>
  }

  private fail(message: string): never {
    const current = this.current()?.range
    const previous = this.tokens[this.index - 1]?.range
    const sourceRange = current ?? (
      previous
        ? { start: previous.end, end: previous.end }
        : undefined
    )

    throw new MindPptCompileError(
      'Slide "' + this.slideId + '" ' + message,
      sourceRange,
    )
  }
}

type ParagraphToken = Extract<Token, { kind: 'text' | 'edge' }>

function isParagraphToken(token: Token): token is ParagraphToken {
  return token.kind === 'text' || token.kind === 'edge'
}

function paragraphText(token: ParagraphToken): string {
  return token.text
}

function parseImageToken(token: Token): ParsedContent | undefined {
  if (token.kind !== 'text') return undefined

  const match = IMAGE.exec(token.text)
  if (!match) return undefined

  return {
    kind: 'image',
    alt: match[1]?.trim() ?? '',
    src: match[2]?.trim() ?? '',
    range: token.range,
  }
}
