import type { MindPptDiagnostic, SlideNode } from './types.ts'

// Coordinates are slide-local semantic boxes, not Excalidraw frame bounds or glyph metrics.
const TOLERANCE = 1e-6

export function contentOverflowWarnings(
  slides: readonly SlideNode[],
): MindPptDiagnostic[] {
  const warnings: MindPptDiagnostic[] = []
  for (const slide of slides) {
    for (const element of slide.elements) {
      if (
        element.x >= -TOLERANCE
        && element.y >= -TOLERANCE
        && element.x + element.width <= slide.width + TOLERANCE
        && element.y + element.height <= slide.height + TOLERANCE
      ) continue

      const location = element.slot ? element.slot + ' slot ' : ''
      warnings.push({
        severity: 'warning',
        message: 'Slide "' + slide.id + '" ' + location + element.kind
          + ' semantic content box exceeds '
          + slide.width + '×' + slide.height + ' slide bounds',
        sourceRange: element.sourceRange,
      })
    }
  }
  return warnings
}
