const BOUND_TEXT_PADDING = 10
const TEXT_LINE_HEIGHT = 1.15
const TEXT_WIDTH_FACTOR = 0.65
const TEXT_HEIGHT_SAFETY = 2

export function textBlockHeight(
  text: string,
  width: number,
  fontSize: number,
  minimum: number,
): number {
  if (!Number.isFinite(width)) return minimum

  const lines = wrappedLineCount(text, width, fontSize)
  const measured = Math.ceil(
    lines * fontSize * TEXT_LINE_HEIGHT
      + BOUND_TEXT_PADDING
      + TEXT_HEIGHT_SAFETY,
  )
  return Math.max(minimum, measured)
}

function wrappedLineCount(
  text: string,
  width: number,
  fontSize: number,
): number {
  const columns = Math.max(
    1,
    Math.floor(
      (width - BOUND_TEXT_PADDING) / (fontSize * TEXT_WIDTH_FACTOR),
    ),
  )

  return text
    .split('\n')
    .reduce(
      (total, line) => total + wrappedPhysicalLineCount(line, columns),
      0,
    )
}

function wrappedPhysicalLineCount(
  line: string,
  columns: number,
): number {
  const words = line.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 1

  let lines = 1
  let used = 0

  for (const word of words) {
    const characters = [...word]

    for (let offset = 0; offset < characters.length; offset += columns) {
      const length = Math.min(columns, characters.length - offset)
      const continuation = offset > 0
      const gap = used === 0 || continuation ? 0 : 1

      if (used + gap + length <= columns) {
        used += gap + length
      } else {
        lines += 1
        used = length
      }
    }
  }

  return lines
}
