# code-parser

Status: draft  
Role: core MindPPT compiler plugin  
Runtime: Cordis

## 1. Responsibility

`code-parser` is the central compiler frontend of MindPPT.

It accepts MindPPT source code and produces a resolved, validated, spatially laid-out `MindPptStructure` that is ready for downstream rendering and camera control.

```text
MindPPT source
      |
      v
  code-parser
      |
      v
MindPptStructure
      |
      +-----------> canvas-excalidraw
      |
      +-----------> camera
```

It is intentionally more than a text-to-AST parser.

The plugin owns the full source-to-structure compilation boundary so that downstream plugins do not need to understand MindPPT syntax, presentation semantics, or layout rules.

## 2. What code-parser owns

The first implementation keeps these phases inside one Cordis plugin:

```text
source
  |
  v
syntax parse
  |
  v
AST
  |
  v
reference resolution
  |
  v
semantic validation
  |
  v
slide layout
  |
  v
mind-map layout
  |
  v
MindPptStructure
```

These are internal compiler stages, not separate packages or plugins.

### 2.1 Syntax parse

Parse the Mermaid-like MindPPT language into an AST while preserving source ranges.

The outer MindPPT language is its own small grammar.

Only graph edge notation intentionally resembles Mermaid:

```mindppt
tree LR {
  intro --> market
  market --> customer
}

link customer -.-> summary
```

Embedded Mermaid remains opaque source text:

```mindppt
diagram architecture {
  type mermaid

  """
  flowchart LR
    User --> API
    API --> DB
  """
}
```

The MindPPT parser must not reimplement Mermaid's full diagram grammar.

### 2.2 Reference resolution

Resolve source-level identifiers after the full document has been parsed.

Examples:

- slide IDs referenced by tree edges;
- slide IDs referenced by soft links;
- slide IDs referenced by paths;
- named slide elements referenced by local arrows;
- logical assets, diagrams, charts, and other named components.

Declaration order must not control whether a reference is valid.

### 2.3 Semantic validation

The compiler reports diagnostics for invalid structures, including:

- duplicate IDs;
- unresolved slide references;
- multiple parents in the primary tree;
- cycles in the primary tree;
- duplicate tree edges;
- chart labels/series length mismatch;
- invalid layout slot usage;
- invalid component properties;
- unreachable slides where useful as a warning.

Validation should distinguish errors that prevent a new structure from being published from warnings that still allow compilation.

### 2.4 Slide layout

The compiler resolves semantic slide layout into slide-local geometry.

Input:

```mindppt
slide market {
  layout two-column

  left {
    title "Market"

    bullets {
      "A"
      "B"
    }
  }

  right {
    chart growth {
      type bar
      labels ["2024", "2025", "2026"]
      series "Market" [100, 116, 137]
    }
  }
}
```

Output conceptually contains:

```text
slide market: 1600 x 900

title
  x: ...
  y: ...
  width: ...
  height: ...

bullets
  x: ...
  y: ...
  width: ...
  height: ...

chart growth
  x: ...
  y: ...
  width: ...
  height: ...
```

The compiler should determine geometry, but preserve semantic component identity.

A chart remains a chart in `MindPptStructure`; it is not flattened into bars, lines, labels, and axes until `canvas-excalidraw` compiles it to Excalidraw elements.

The same rule applies to tables and embedded diagrams.

### 2.5 Mind-map layout

The compiler also resolves the primary tree into world-space slide positions.

Example source:

```mindppt
tree LR {
  intro --> market
  market --> size
  market --> customer
  market --> competitor
  customer --> product
}
```

Conceptual result:

```text
intro       (0, 0)
market      (2200, 0)
size        (4400, -1200)
customer    (4400, 0)
competitor  (4400, 1200)
product     (6600, 0)
```

The exact layout algorithm is implementation work, but the output contract is not: every slide published to downstream plugins has a world-space position and dimensions.

Tree layout should use the primary tree only. Soft links do not change parent ownership or the primary layout.

## 3. Output boundary

The output should be high-level enough to retain presentation semantics and concrete enough that the renderer does not perform presentation layout.

A minimal shape is:

```ts
interface MindPptStructure {
  deck: DeckSpec
  slides: SlideNode[]
  tree: TreeEdge[]
  links: SoftLink[]
  paths: PresentationPath[]
  diagnostics: Diagnostic[]
  sourceMap: SourceMap
}
```

Each slide contains world geometry plus slide-local elements:

```ts
interface SlideNode {
  id: string

  x: number
  y: number
  width: number
  height: number

  elements: RenderNode[]
}
```

A `RenderNode` may still be semantic:

```text
text
image
rectangle
ellipse
diamond
line
arrow
group
table
chart
diagram
```

Every render node has resolved slide-local geometry.

`canvas-excalidraw` is then responsible for the mechanical lowering step:

```text
slide -> Excalidraw frame
text -> Excalidraw text
table -> rectangles + lines + text
chart -> Excalidraw chart renderer
diagram -> Mermaid-to-Excalidraw
...
```

## 4. Coordinate model

The compiler uses two coordinate spaces.

### World coordinates

Owned by each slide:

```text
slide.x
slide.y
slide.width
slide.height
```

These locate the slide on the infinite mind-map canvas.

### Slide-local coordinates

Owned by elements inside a slide:

```text
element.x
element.y
element.width
element.height
```

The renderer can derive canvas coordinates mechanically:

```text
worldElementX = slide.x + element.x
worldElementY = slide.y + element.y
```

This keeps slide layout independent from mind-map placement.

## 5. Source map

Source ranges are a first-class compiler output.

The compiler should be able to resolve semantic IDs back to source ranges:

```text
slide:market
  -> lines 20-42

slide:market/chart:growth
  -> lines 31-37
```

This enables:

- clicking rendered content and jumping the code editor to its source;
- precise DSH agent patches;
- diagnostics attached to the relevant source range;
- future refactoring tools.

Source mapping should exist from the first parser implementation rather than being retrofitted later.

## 6. Stable semantic identity

Recompilation must not make every rendered object appear new.

Named declarations naturally provide stable semantic keys:

```text
slide:market
slide:market/chart:growth
slide:customer/image:persona
```

Unnamed components should receive deterministic keys derived from their stable structural AST path rather than random IDs.

Example:

```text
slide:market/left/title:0
slide:market/left/bullets:0
```

The parser does not need to manufacture final Excalidraw element IDs. It must, however, publish stable semantic identity so `canvas-excalidraw` can map it deterministically to rendered IDs.

This is necessary for:

- efficient diffing;
- preserving selection where appropriate;
- future shared-element transitions;
- camera continuity;
- avoiding whole-canvas replacement after small source edits.

## 7. Live editing and last-good output

MindPPT source is edited interactively, so temporary syntax errors are normal.

A half-written block must not erase the entire preview.

The parser service should distinguish:

```text
current source
latest diagnostics
last successful MindPptStructure
```

Expected behavior:

```text
source change
    |
    v
compile
  /   \
success error
 |      |
 v      v
publish  publish diagnostics
new      keep last-good structure
structure
```

A syntax or semantic error therefore updates diagnostics while the canvas continues displaying the latest valid structure.

## 8. Cordis service boundary

The public surface should stay small and runtime-native.

Conceptually:

```ts
ctx.mindpptParser.compile(source)
ctx.mindpptParser.structure
ctx.mindpptParser.diagnostics
ctx.mindpptParser.sourceMap
```

The exact names are implementation details.

Expected events are conceptually:

```text
mindppt/compiled
mindppt/diagnostics
```

Downstream behavior:

```text
code-editor
    |
    | source changed
    v
code-parser
    |
    | compiled structure
    +--------------+
    |              |
    v              v
canvas-excalidraw camera
```

No supported standalone parser API is required outside Cordis.

## 9. What code-parser does not own

`code-parser` does not own:

- source editing UI;
- Excalidraw element creation;
- direct canvas mutation;
- Excalidraw viewport state;
- camera animation timing;
- DSH agent prompts or authoring policy;
- DSH sidebar mounting;
- final PPTX export.

In particular, it does not decide presentation-writing quality rules such as preferring balanced branching over a long sequence. Those belong to `dsh-capability`.

The parser only enforces structural validity and produces geometry.

## 10. First implementation milestone

The first parser branch should target one concrete acceptance test:

> Compile `examples/market-overview.mindppt` into a deterministic `MindPptStructure` JSON representation without rendering anything.

That result should include:

- deck metadata;
- all seven slides;
- resolved tree edges;
- the soft link;
- both presentation paths;
- resolved slide dimensions;
- deterministic world-space slide positions;
- slide-local geometry for every component;
- semantic chart/table/diagram nodes;
- stable semantic IDs;
- source ranges;
- zero errors for the example.

Only after this output is stable should `canvas-excalidraw` become the next implementation focus.
