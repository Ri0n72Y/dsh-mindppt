import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type {
  BarChartNode,
  SlideNode,
  TableNode,
} from 'dsh-mindppt-code-parser'

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
    backgroundColor: headerIds.has(cell.id) ? '#eef2ff' : '#ffffff',
    strokeColor: '#a8a8b3',
    fillStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
    label: {
      text: String(cell.value),
      fontSize: 17,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: '#1b1b1f',
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
    strokeColor: '#6b7280',
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
      backgroundColor: '#6366f1',
      strokeColor: '#4f46e5',
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
        fontSize: 16,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: '#1b1b1f',
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
        fontSize: 15,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: '#374151',
      },
    },
  ])

  return [baseline, ...bars]
}
