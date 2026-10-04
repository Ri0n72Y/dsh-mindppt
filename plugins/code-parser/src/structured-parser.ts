import { MindPptCompileError } from './errors.ts'
import type {
  ParsedChartLabel,
  ParsedChartValue,
  ParsedContent,
  ParsedStructuredValue,
} from './parsed-types.ts'
import type { StructuredLine, Token } from './tokenizer.ts'
import type { SourceRange, StructuredValue } from './types.ts'

export function parseTableBlock(
  token: Extract<Token, { kind: 'table-block' }>,
  slideId: string,
): ParsedContent {
  let header: ParsedStructuredValue[] | undefined
  let headerRange: SourceRange | undefined
  const rows: ParsedStructuredValue[][] = []
  const rowRanges: SourceRange[] = []

  for (const line of token.lines) {
    if (!line.text) continue

    if (line.text.startsWith('header ')) {
      if (header) {
        failStructured(slideId, 'table must contain exactly one header row', line.range)
      }
      headerRange = line.range
      header = parseStructuredValues(line, 'header', slideId, 'table')
      continue
    }

    if (line.text.startsWith('row ')) {
      rowRanges.push(line.range)
      rows.push(parseStructuredValues(line, 'row', slideId, 'table'))
      continue
    }

    failStructured(slideId, 'table supports only header and row statements', line.range)
  }

  if (!header) {
    failStructured(slideId, 'table requires exactly one header row', token.range)
  }
  if (header.length === 0) {
    failStructured(
      slideId,
      'table header must contain at least one cell',
      headerRange ?? token.range,
    )
  }

  for (const [index, row] of rows.entries()) {
    if (row.length !== header.length) {
      failStructured(
        slideId,
        'table row width must match header column count',
        rowRanges[index] ?? token.range,
      )
    }
  }

  return { kind: 'table', header, rows, range: token.range }
}

export function parseBarChartBlock(
  token: Extract<Token, { kind: 'bar-chart-block' }>,
  slideId: string,
): ParsedContent {
  let labels: ParsedChartLabel[] | undefined
  let labelsRange: SourceRange | undefined
  let values: ParsedChartValue[] | undefined
  let valuesRange: SourceRange | undefined

  for (const line of token.lines) {
    if (!line.text) continue

    if (line.text.startsWith('labels ')) {
      if (labels) failStructured(slideId, 'chart bar has duplicate labels', line.range)
      labelsRange = line.range
      const parsed = parseArray(line, 'labels', slideId, 'chart bar')
      labels = parsed.map((value) => {
        if (typeof value !== 'string') {
          failStructured(slideId, 'chart labels must be strings', line.range)
        }
        return { value, range: line.range }
      })
      continue
    }

    if (line.text.startsWith('values ')) {
      if (values) failStructured(slideId, 'chart bar has duplicate values', line.range)
      valuesRange = line.range
      const parsed = parseArray(line, 'values', slideId, 'chart bar')
      values = parsed.map((value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          failStructured(slideId, 'chart values must be finite numbers', line.range)
        }
        return { value, range: line.range }
      })
      continue
    }

    failStructured(slideId, 'chart bar supports only labels and values statements', line.range)
  }

  if (!labels) failStructured(slideId, 'chart bar requires labels', token.range)
  if (!values) failStructured(slideId, 'chart bar requires values', token.range)
  if (labels.length === 0) {
    failStructured(
      slideId,
      'chart bar requires at least one category',
      labelsRange ?? token.range,
    )
  }
  if (labels.length !== values.length) {
    failStructured(
      slideId,
      'chart category/value count mismatch',
      valuesRange ?? token.range,
    )
  }

  return { kind: 'bar-chart', labels, values, range: token.range }
}

function parseStructuredValues(
  line: StructuredLine,
  keyword: string,
  slideId: string,
  owner: string,
): ParsedStructuredValue[] {
  return parseArray(line, keyword, slideId, owner).map((value) => {
    if (!isStructuredValue(value)) {
      failStructured(slideId, owner + ' cells must be strings or finite numbers', line.range)
    }
    return { value, range: line.range }
  })
}

function parseArray(
  line: StructuredLine,
  keyword: string,
  slideId: string,
  owner: string,
): unknown[] {
  const payload = line.text.slice(keyword.length).trim()
  let parsed: unknown

  try {
    parsed = JSON.parse(payload)
  } catch {
    failStructured(slideId, owner + ' ' + keyword + ' must be a JSON array', line.range)
  }

  if (!Array.isArray(parsed)) {
    failStructured(slideId, owner + ' ' + keyword + ' must be a JSON array', line.range)
  }
  return parsed
}

function failStructured(
  slideId: string,
  message: string,
  sourceRange: SourceRange,
): never {
  throw new MindPptCompileError('Slide "' + slideId + '" ' + message, sourceRange)
}

function isStructuredValue(value: unknown): value is StructuredValue {
  return typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value))
}
