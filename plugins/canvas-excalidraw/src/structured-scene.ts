import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  BarChartNode,
  SlideNode,
  TableNode,
} from 'dsh-mindppt-code-parser'

import { neutral, typeSize } from './visual-style.ts'

export function renderTable(
  slide: SlideNode,
  table: TableNode,
): ExcalidrawElementSkeleton[] {
  const headerIds = new Set(table.header.map((cell) => cell.id))
  return [...table.header, ...table.rows.flat()].map((cell) => ({
    type: 'rectangle',
    id: cell.id + '/box',
    x: slide.x + cell.x,
    y: slide.y + cell.y,
    width: cell.width,
    height: cell.height,
    backgroundColor: headerIds.has(cell.id) ? neutral.header : neutral.surface,
    strokeColor: neutral.border,
    fillStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
    label: {
      text: String(cell.value),
      fontSize: typeSize.data,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: headerIds.has(cell.id) ? neutral.title : neutral.body,
    },
  }))
}

export function renderBarChart(
  slide: SlideNode,
  chart: BarChartNode,
): ExcalidrawElementSkeleton[] {
  const baseline: ExcalidrawElementSkeleton = {
    type: 'line',
    id: chart.id + '/baseline',
    x: slide.x + chart.plotX,
    y: slide.y + chart.baselineY,
    points: [
      [0, 0],
      [chart.plotWidth, 0],
    ],
    strokeColor: neutral.muted,
    strokeWidth: 1,
    roughness: 0,
  }

  const bars: ExcalidrawElementSkeleton[] = chart.bars.flatMap((bar) => [
    {
      type: 'rectangle',
      id: bar.id + '/box',
      x: slide.x + bar.x,
      y: slide.y + bar.y,
      width: bar.width,
      height: bar.height,
      backgroundColor: neutral.accent,
      strokeColor: neutral.accentBorder,
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
    },
    {
      type: 'rectangle',
      id: bar.id + '/label',
      x: slide.x + bar.labelX,
      y: slide.y + bar.labelY,
      width: bar.labelWidth,
      height: bar.labelHeight,
      backgroundColor: 'transparent',
      strokeColor: 'transparent',
      fillStyle: 'solid',
      roughness: 0,
      label: {
        text: bar.label,
        fontSize: typeSize.category,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: neutral.secondary,
      },
    },
    {
      type: 'rectangle',
      id: bar.id + '/value',
      x: slide.x + bar.valueLabelX,
      y: slide.y + bar.valueLabelY,
      width: bar.valueLabelWidth,
      height: bar.valueLabelHeight,
      backgroundColor: 'transparent',
      strokeColor: 'transparent',
      fillStyle: 'solid',
      roughness: 0,
      label: {
        text: String(bar.value),
        fontSize: typeSize.value,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: neutral.body,
      },
    },
  ])

  return [baseline, ...bars]
}
