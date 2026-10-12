import { describe, expect, it } from 'vitest'
import { compileSource } from '../src/compiler.ts'
import { MindPptCompileError } from '../src/errors.ts'
import { tokenize } from '../src/tokenizer.ts'

describe('standalone // line comments', () => {
  it('ignores standalone and whitespace-prefixed lines without rewriting adjacent tokens', () => {
    const source = [
      ' // first', '\t// second', '//', 'mindppt',
      'slide demo {', '  # Title // still text',
      '  Visit https://example.com/a//b', '}',
    ].join('\n')
    const tokens = tokenize(source)
    expect(tokens.map(token => token.kind)).toEqual([
      'marker', 'slide-start', 'heading', 'text', 'block-end',
    ])
    expect(tokens[2]).toEqual(expect.objectContaining({
      kind: 'heading', text: 'Title // still text',
    }))
    expect(tokens[3]).toEqual(expect.objectContaining({
      kind: 'text', text: 'Visit https://example.com/a//b',
    }))
    for (const token of tokens) {
      expect(source.slice(token.range.start, token.range.end))
        .not.toMatch(/^\s*\/\//)
    }
  })

  it('preserves structural semantics and stable IDs across comments in every supported scope', () => {
    const source = [
      '  // author: 🧭 beginning',
      'mindppt',
      '// author: top-level',
      'tree LR {',
      '  // author: inside tree',
      '  start --> end',
      '}',
      'link start -.-> end',
      '// author: between declarations',
      'path route {',
      '  // author: inside path',
      '  start',
      '  end',
      '}',
      'slide start {',
      '  // author: inside slide',
      '  layout two-column',
      '  # Report // heading text',
      '  left {',
      '    // author: inside left slot',
      '    table {',
      '      // author: before header',
      '      header ["Source", "URL"]',
      '      row ["🧪", "https://example.com/a//b"]',
      '      // author: after row',
      '    }',
      '    Visit https://example.com/a//b',
      '  }',
      '  right {',
      '    // author: inside right slot',
      '    chart bar {',
      '      // author: before labels',
      '      labels ["Direct", "Partner"]',
      '      values [2, 3]',
      '      // author: after values',
      '    }',
      '    ```custom',
      '    // raw: keep inside extension',
      '    https://example.com//raw',
      '    ```',
      '  }',
      '}',
      'slide end {',
      '  # Final',
      '}',
      '// author: at EOF',
    ].join('\n')
    const uncommented = source.split('\n')
      .filter(line => !line.trimStart().startsWith('// author:'))
      .join('\n')
    const compiled = compileSource(source)
    const expected = compileSource(uncommented)

    const semantic = (key: string, value: unknown) =>
      (key === 'sourceRange' || key.endsWith('SourceRange'))
        ? undefined : value
    expect(JSON.stringify(compiled, semantic))
      .toBe(JSON.stringify(expected, semantic))
    expect(compiled.slides.map(slide => slide.id)).toEqual(['start', 'end'])
    expect(compiled.tree?.edges.map(edge => edge.id)).toEqual(['tree:start->end'])
    expect(compiled.links?.map(link => link.id)).toEqual(['link:start->end'])
    expect(compiled.paths?.[0]?.occurrences.map(o => o.slideId))
      .toEqual(['start', 'end'])

    const start = compiled.slides[0]!
    expect(start.sourceRange.start).toBe(source.indexOf('slide start {'))
    const treeEdge = compiled.tree!.edges[0]!
    expect(source.slice(treeEdge.sourceRange.start, treeEdge.sourceRange.end))
      .toBe('  start --> end')
    const link = compiled.links![0]!
    expect(source.slice(link.sourceRange.start, link.sourceRange.end))
      .toBe('link start -.-> end')
    const pathOccurrence = compiled.paths![0]!.occurrences[1]!
    expect(source.slice(pathOccurrence.sourceRange.start, pathOccurrence.sourceRange.end))
      .toBe('  end')
    const table = start.elements.find(element => element.kind === 'table')
    const chart = start.elements.find(element => element.kind === 'bar-chart')
    const extension = start.elements.find(element => element.kind === 'extension')
    expect(start.elements.map(element => element.kind))
      .toEqual(['title', 'table', 'text', 'bar-chart', 'extension'])
    expect(source.slice(start.sourceRange.start, start.sourceRange.end))
      .toContain('    // author: inside left slot')
    expect(source.slice(table!.sourceRange.start, table!.sourceRange.end))
      .toContain('      // author: before header')
    expect(source.slice(chart!.sourceRange.start, chart!.sourceRange.end))
      .toContain('      // author: before labels')
    expect(source.slice(extension!.sourceRange.start, extension!.sourceRange.end))
      .toContain('    // raw: keep inside extension')
    if (table?.kind !== 'table' || chart?.kind !== 'bar-chart') {
      throw new Error('Expected parsed structured content')
    }
    expect(table.rows[0]?.[1]?.value).toBe('https://example.com/a//b')
    expect(chart.bars.map(bar => bar.value)).toEqual([2, 3])
    expect(source.slice(table.rows[0]![0]!.sourceRange.start,
      table.rows[0]![0]!.sourceRange.end))
      .toBe('      row ["🧪", "https://example.com/a//b"]')
    const fence = tokenize(source).find(token => token.kind === 'fence')
    expect(fence).toEqual(expect.objectContaining({
      type: 'custom',
      raw: '    // raw: keep inside extension\n    https://example.com//raw',
    }))
  })

  it('preserves actual UTF-16 ranges and does not accept inline JSON comments', () => {
    const source = [
      '// 🚀 comment',
      'mindppt',
      'slide demo {',
      '  chart bar {',
      '    // 📈 comment',
      '    labels ["A"]',
      '    values [1] // unsupported trailing comment',
      '  }',
      '}',
    ].join('\r\n')
    let failure: unknown
    try { compileSource(source) } catch (error) { failure = error }
    expect(failure).toBeInstanceOf(MindPptCompileError)
    const range = (failure as MindPptCompileError).sourceRange!
    expect(range.start).toBe(source.indexOf('    values [1] //'))
    expect(source.slice(range.start, range.end))
      .toBe('    values [1] // unsupported trailing comment\r')
    expect((failure as Error).message)
      .toContain('chart bar values must be a JSON array')
  })
})
