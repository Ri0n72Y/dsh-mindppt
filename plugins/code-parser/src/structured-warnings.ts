import type { MindPptDiagnostic, SlideNode } from './types.ts'

// Fixed v0 data presentation policy, not a glyph-measurement or layout engine.
const MIN_TABLE_ROW_HEIGHT = 26
const MAX_CATEGORY_CHARACTERS = 24
const MAX_UNBROKEN_CHARACTERS = 12
const NARROW_CATEGORY_WIDTH = 80

export function dataReadabilityWarnings(
  slides: readonly SlideNode[],
): MindPptDiagnostic[] {
  const warnings: MindPptDiagnostic[] = []
  for (const slide of slides) {
    for (const element of slide.elements) {
      if (element.kind === 'table') {
        const rowHeight = element.height / (element.rows.length + 1)
        if (rowHeight < MIN_TABLE_ROW_HEIGHT) {
          warnings.push({
            severity: 'warning',
            message: 'Slide "' + slide.id + '" table rows are too dense for '
              + '17px labels (minimum 26px row). Shorten or split the table.',
            sourceRange: element.sourceRange,
          })
        }
      }
      if (element.kind === 'bar-chart') {
        for (const bar of element.bars) {
          const characters = Array.from(bar.label).length
          const words = bar.label.split(/\s+/)
          const longest = Math.max(...words.map(word => Array.from(word).length))
          if (
            characters > MAX_CATEGORY_CHARACTERS
            || longest > MAX_UNBROKEN_CHARACTERS
            || (bar.labelWidth < NARROW_CATEGORY_WIDTH && characters > 10)
            || bar.label.split('\n').length > 2
          ) {
            warnings.push({
              severity: 'warning',
              message: 'Slide "' + slide.id + '" bar-chart category "'
                + bar.label + '" may exceed its two-line label box. '
                + 'Shorten the label or reduce categories.',
              sourceRange: bar.labelSourceRange,
            })
          }
        }
      }
    }
  }
  return warnings
}
