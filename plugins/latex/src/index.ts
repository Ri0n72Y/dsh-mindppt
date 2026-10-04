import type { Context } from '@deepseek-ai/cordis'
import type { ExtensionRenderer } from 'dsh-mindppt-canvas-excalidraw'

export const name = 'dsh-mindppt-latex'
export const inject = ['mindpptCanvas']

interface FormulaParts {
  base: string
  superscript?: string
  suffix: string
}

export const renderLatex: ExtensionRenderer = ({ slide, element }) => {
  const x = slide.x + element.x
  const y = slide.y + element.y
  const formula = parseFormula(element.raw)
  const padding = Math.min(20, Math.max(10, element.width * 0.035))
  const maxFontSize = Math.min(38, Math.max(24, element.height * 0.38))
  const scriptRatio = 0.62
  const units = textUnits(formula.base)
    + textUnits(formula.suffix)
    + (formula.superscript
      ? textUnits(formula.superscript) * scriptRatio
      : 0)
  const fontSize = Math.max(
    18,
    Math.min(maxFontSize, (element.width - padding * 2) / Math.max(units, 1)),
  )
  const scriptSize = fontSize * scriptRatio
  const baseWidth = measuredWidth(formula.base, fontSize)
  const scriptWidth = formula.superscript
    ? measuredWidth(formula.superscript, scriptSize)
    : 0
  const suffixWidth = measuredWidth(formula.suffix, fontSize)
  const totalWidth = baseWidth + scriptWidth + suffixWidth
  const startX = x + Math.max(padding, (element.width - totalWidth) / 2)
  const baselineY = y + element.height / 2 - fontSize * 0.45

  const scene: ReturnType<ExtensionRenderer> = [{
    type: 'rectangle',
    id: element.id + '/latex/box',
    x,
    y,
    width: element.width,
    height: element.height,
    backgroundColor: '#ffffff',
    strokeColor: '#c7ccd1',
    fillStyle: 'solid',
    strokeWidth: 1,
    roughness: 0,
  }]

  scene.push(textSegment(
    element.id + '/latex/base',
    formula.base,
    startX,
    baselineY,
    baseWidth,
    fontSize * 1.25,
    fontSize,
  ))

  let cursorX = startX + baseWidth

  if (formula.superscript) {
    scene.push(textSegment(
      element.id + '/latex/superscript',
      formula.superscript,
      cursorX,
      baselineY - scriptSize * 0.7,
      scriptWidth,
      scriptSize * 1.2,
      scriptSize,
    ))
    cursorX += scriptWidth
  }

  if (formula.suffix) {
    scene.push(textSegment(
      element.id + '/latex/suffix',
      formula.suffix,
      cursorX,
      baselineY,
      suffixWidth,
      fontSize * 1.25,
      fontSize,
    ))
  }

  return scene
}

export function apply(ctx: Context): void {
  ctx.effect(() =>
    ctx.mindpptCanvas.registerExtensionRenderer('latex', renderLatex),
  )
}

export default {
  name,
  inject,
  apply,
}

function parseFormula(raw: string): FormulaParts {
  const source = raw.trim()
  const match = /^(.*?)\^\{([^{}]+)\}(.*)$/s.exec(source)

  if (!match) {
    return {
      base: normalizeLatex(source),
      suffix: '',
    }
  }

  return {
    base: normalizeLatex(match[1] ?? ''),
    superscript: normalizeLatex(match[2] ?? ''),
    suffix: normalizeLatex(match[3] ?? ''),
  }
}

function normalizeLatex(value: string): string {
  return value
    .replace(/\\pi\b/g, 'π')
    .replace(/\\ne\b/g, '≠')
    .replace(/\\times\b/g, '×')
    .replace(/\s+/g, ' ')
    .trim()
}

function textUnits(value: string): number {
  return Math.max(0.75, value.length * 0.62)
}

function measuredWidth(value: string, fontSize: number): number {
  return textUnits(value) * fontSize
}

function textSegment(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
): ReturnType<ExtensionRenderer>[number] {
  return {
    type: 'rectangle',
    id,
    x,
    y,
    width,
    height,
    backgroundColor: 'transparent',
    strokeColor: 'transparent',
    fillStyle: 'solid',
    roughness: 0,
    label: {
      text,
      fontSize,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: '#111827',
    },
  }
}
