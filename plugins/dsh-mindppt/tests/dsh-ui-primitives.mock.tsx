import type { ButtonHTMLAttributes, ReactNode } from 'react'

// DSH owns the real UI primitives. Unit tests check our slot/gesture wiring,
// without loading the host's published React/CSS/Markdown component graph.
export function Button({ variant: _variant, size: _size, icon, ...props }: (
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    icon?: ReactNode
  }
)) {
  return <button type="button" {...props}>{icon}{props.children}</button>
}

export function Menu({ anchor }: { anchor: ReactNode }) {
  return <span>{anchor}</span>
}

export function IconChevronDownOutlineRegular() {
  return <span aria-hidden="true">⌄</span>
}
