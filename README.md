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


## Hello-world vertical slice

The first delivery milestone deliberately supports only:

```mindppt
mindppt

slide hello {
  title "Hello World"
}
```

but runs through the real plugin path:

```text
examples/hello-world.mindppt
        |
        v
ctx.mindpptParser.compile(source)
        |
        | mindppt/compiled
        v
ctx.mindpptCanvas
        |
        v
Excalidraw elements
        |
        v
apps/playground -> <Excalidraw />
```

Run the standalone playground with:

```sh
pnpm install
pnpm dev
```

The rendered canvas is view-only: source remains the single source of truth.

This vertical slice is the delivery contract for subsequent parser work. New syntax should extend the same path and ship with an end-to-end fixture rather than being implemented as an isolated parser feature.
