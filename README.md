# dsh-mindppt

MindPPT is a Cordis-native experiment that treats presentation slides as nodes on an infinite mind-map canvas.

The project is intentionally **Cordis-entangled**: major capabilities are implemented as Cordis plugins and services rather than standalone domain libraries. DSH integration is optional, while Cordis is part of the runtime architecture.

## Core idea

```text
MindPPT source code
       |
       v
   code-parser
       |
       v
MindPPT structure
   |          |
   v          v
canvas      camera
   |
   v
Excalidraw
```

A slide is rendered as an Excalidraw frame. Tree edges define the primary spatial structure, soft links add cross-tree relations, and presentation paths define optional playback routes through that structure.

## Initial plugin split

- `code-editor` — edits MindPPT source; source code is the single source of truth.
- `code-parser` — parses MindPPT source into the renderable structure.
- `canvas-excalidraw` — subscribes to compiled structures and lowers them to Excalidraw elements.
- `camera` — controls presentation navigation and viewport transitions.
- `dsh-capability` — exposes authoring knowledge, source access, templates, and agent-facing tools to DSH.
- `dsh-mindppt-sidebar` — mounts MindPPT into the DSH sidebar.

The standalone web host will run the same Cordis plugins without requiring DSH.

Web graphical interfaces are written in React + TypeScript. React owns host UI composition; Excalidraw remains the canvas renderer rather than the application state model.

## Design documents

- `docs/language-v0.md` — MindPPT Language v0 draft.
- `docs/code-parser.md` — compiler boundary, output model, source mapping, and stable identity.
- `docs/roadmap.md` — accepted v0 implementation roadmap and milestone delivery contract.


## Current vertical slice: M2

M1 established the structural parser, two-slide LR topology, stable semantic IDs, source ranges, and real Excalidraw delivery. M2 extends the same path with the first intentional Markdown content profile.

Current fixture:

````mindppt
mindppt

tree LR {
  overview --> math
}

slide overview {
  # Outdoor Market

  ## 2026 snapshot

  Demand remains seasonal.

  - Premium products gain share
  - Online channels continue growing
}

slide math {
  # Euler Identity

  A compact mathematical example.

  ```latex
  e^{i\pi} + 1 = 0
  ```
}
````

M2 content currently lowers through semantic nodes:

```text
# heading        -> title
## heading       -> subtitle
paragraph        -> text
- item           -> unordered list
1. item          -> ordered list
fenced block     -> extension
```

Unknown extensions remain valid and render through a readable fallback. No extension-specific parser registration exists.

Run the standalone playground with:

```sh
pnpm install
pnpm dev
```

The canvas remains a projection of source code. Direct canvas editing is not a semantic authoring path.
