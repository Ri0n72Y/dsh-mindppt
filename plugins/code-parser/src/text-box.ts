// Excalidraw 0.18 rectangles expose width - 10px to a bound label and
// create Excalifont labels at lineHeight 1.25. Keep those values here so
// compiler geometry matches the actual conversion contract.
const BOUND_TEXT_PADDING = 10
const TEXT_LINE_HEIGHT = 1.25

// Avoid an average per-codepoint width. The current Excalifont lowering
// domain uses coarse em ceilings for Basic Latin, a full em for fallback
// glyphs such as CJK/full-width text, and two em for emoji presentation.
// Real Chromium conversion regressions pin these buckets to the renderer.
const NARROW_ASCII = " !\"'(),./:;I[]il|{}"
const WIDE_ASCII = '#%&@MWmw'
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u

export function textBlockHeight(
  text: string,
  width: number,
  fontSize: number,
  minimum: number,
): number {
  if (!Number.isFinite(width)) return minimum

  const lines = wrappedLineCount(text, width, fontSize)
  const measured = Math.ceil(
    lines * fontSize * TEXT_LINE_HEIGHT + BOUND_TEXT_PADDING,
  )
  return Math.max(minimum, measured)
}

function wrappedLineCount(
  text: string,
  width: number,
  fontSize: number,
): number {
  const maxAdvance = Math.max(
    1,
    (width - BOUND_TEXT_PADDING) / fontSize,
  )

  return text
    .normalize('NFC')
    .split('\n')
    .reduce(
      (total, line) => total + wrappedPhysicalLineCount(line, maxAdvance),
      0,
    )
}

function wrappedPhysicalLineCount(
  line: string,
  maxAdvance: number,
): number {
  const words = line.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 1

  let lines = 1
  let used = 0

  for (const word of words) {
    const chunks = splitWord(word, maxAdvance)

    if (chunks.length > 1) {
      if (used > 0) {
        lines += 1
        used = 0
      }
      lines += chunks.length - 1
      used = chunks.at(-1) ?? 0
      continue
    }

    const wordAdvance = chunks[0] ?? 0
    const gap = used === 0 ? 0 : advanceOf(' ')

    if (used + gap + wordAdvance <= maxAdvance) {
      used += gap + wordAdvance
    } else {
      lines += 1
      used = wordAdvance
    }
  }

  return lines
}

function splitWord(word: string, maxAdvance: number): number[] {
  const chunks: number[] = []
  let used = 0

  for (const character of word) {
    const advance = advanceOf(character)
    if (used > 0 && used + advance > maxAdvance) {
      chunks.push(used)
      used = 0
    }
    used += advance
  }

  if (used > 0) chunks.push(used)
  return chunks
}

function advanceOf(character: string): number {
  if (EMOJI.test(character)) return 2
  if (character.codePointAt(0)! > 0x7f) return 1
  if (NARROW_ASCII.includes(character)) return 0.5
  if (WIDE_ASCII.includes(character)) return 1
  return 0.75
}
