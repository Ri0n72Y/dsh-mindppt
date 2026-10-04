import type { ParsedContent } from './parsed-types.ts'
import type {
  BarChartNode,
  LayoutSlot,
  SourceRange,
  TableNode,
} from './types.ts'

interface StructuredPlacement {
  id: string
  x: number
  y: number
  width: number
  height: number
  slot?: LayoutSlot
  sourceRange: SourceRange
}

type ParsedTable = Extract<ParsedContent, { kind: 'table' }>
type ParsedBarChart = Extract<ParsedContent, { kind: 'bar-chart' }>

export function layoutTable(
  block: ParsedTable,
  placement: StructuredPlacement,
): TableNode {
  const rowCount = block.rows.length + 1
  const rowHeight = placement.height / rowCount
  const columnWidth = placement.width / block.header.length
  const slot = placement.slot ? { slot: placement.slot } : {}

  const cells = (values: ParsedTable['header'], rowIndex: number) =>
    values.map((cell, columnIndex) => ({
      id: placement.id
        + (rowIndex === 0 ? '/header:' : '/row:' + (rowIndex - 1) + '/cell:')
        + columnIndex,
      value: cell.value,
      x: placement.x + columnIndex * columnWidth,
      y: placement.y + rowIndex * rowHeight,
      width: columnWidth,
      height: rowHeight,
      sourceRange: cell.range,
    }))

  return {
    ...placement,
    ...slot,
    kind: 'table',
    header: cells(block.header, 0),
    rows: block.rows.map((row, index) => cells(row, index + 1)),
  }
}

export function layoutBarChart(
  block: ParsedBarChart,
  placement: StructuredPlacement,
): BarChartNode {
  const plotX = placement.x + 28
  const plotY = placement.y + 28
  const plotWidth = placement.width - 44
  const plotHeight = placement.height - 92
  const values = block.values.map((entry) => entry.value)
  const domainMin = Math.min(0, ...values)
  const domainMax = Math.max(0, ...values)
  const domainSpan = domainMax - domainMin || 1
  const baselineY = plotY + (domainMax / domainSpan) * plotHeight
  const categoryWidth = plotWidth / block.labels.length
  const barWidth = categoryWidth * 0.56
  const labelY = plotY + plotHeight + 12
  const slot = placement.slot ? { slot: placement.slot } : {}

  const bars = block.labels.map((label, index) => {
    const value = block.values[index]!
    const valueHeight = Math.abs(value.value / domainSpan) * plotHeight
    const x = plotX + index * categoryWidth + (categoryWidth - barWidth) / 2
    const y = value.value >= 0 ? baselineY - valueHeight : baselineY
    const valueLabelY = value.value >= 0
      ? Math.max(plotY, y - 26)
      : Math.min(plotY + plotHeight - 22, y + valueHeight + 4)

    return {
      id: placement.id + '/bar:' + index,
      label: label.value,
      value: value.value,
      x,
      y,
      width: barWidth,
      height: valueHeight,
      labelX: plotX + index * categoryWidth,
      labelY,
      labelWidth: categoryWidth,
      labelHeight: 40,
      valueLabelX: plotX + index * categoryWidth,
      valueLabelY,
      valueLabelWidth: categoryWidth,
      valueLabelHeight: 24,
      labelSourceRange: label.range,
      valueSourceRange: value.range,
    }
  })

  return {
    ...placement,
    ...slot,
    kind: 'bar-chart',
    plotX,
    plotY,
    plotWidth,
    plotHeight,
    baselineY,
    bars,
  }
}
