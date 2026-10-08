# Implemented MindPPT v0 syntax

A file begins with `mindppt` and may contain one tree, slides, soft links and paths:

```text
mindppt
tree LR {
  intro --> analysis
}
link intro -.-> analysis
slide intro {
  layout hero
  # Overview
}
slide analysis {
  layout two-column
  # Evidence
  left {
    table {
      header ["Channel", "Orders"]
      row ["Direct", 184]
    }
  }
  right {
    chart bar {
      labels ["Direct", "Partner"]
      values [184, 121]
    }
  }
}
path main {
  intro
  analysis
}
```

- Tree directions: `LR`, `RL`, `TB`, `TD`, `BT`. Primary relations use `-->`. Soft links use `link a -.-> b`. Path occurrences are slide IDs, one per line.
- Layouts: `hero`, `title-content`, `two-column`. Only `two-column` takes `left { ... }` and `right { ... }` slots.
- Markdown content: `# Title`, `## Subtitle`, paragraphs, bullet/numbered lists, `![alt](./assets/picture.png)`, fenced extensions.
- Structured content must be **exactly** `table {` (one `header [JSON array]` plus matching `row [JSON array]` lines) or `chart bar {` (one series via `labels [JSON string array]` and `values [JSON finite number array]`). 
- A fenced `latex` block can use the active renderer. Other fences are generic extension fallback; a `mermaid` fence does not imply Mermaid rendering.
- Unsupported: `deck {}`, named table/chart blocks, line/multi-series charts, or CSS-style layouts.
- Local image assets resolve **relative to the workspace .mindppt file**, not the plugin or skill bundle.
- Compile diagnostics include UTF-16 source offsets surfaced as line:column. With invalid source, a previous successfully compiled scene may still be displayed and marked stale.
