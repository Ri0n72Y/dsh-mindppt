# MindPPT Roadmap

Status: accepted v0 implementation roadmap  
Baseline: M4 merged to `main`  
Architecture: Cordis-native runtime, React + TypeScript host UI, Excalidraw canvas rendering

## 1. Product direction

MindPPT is a spatial presentation language.

A slide is also a mind-map node. The document describes:

1. slide content;
2. spatial topology between slides;
3. optional presentation routes through that topology.

The source file is the single source of truth.

```text
MindPPT source
      |
      v
 code-parser
      |
      v
MindPptStructure
   |          |
   v          v
canvas      camera
   |
   v
Excalidraw
```

Development follows vertical slices. Every milestone should extend this same delivery path rather than build isolated parser or renderer subsystems.

## 2. Architecture invariants

These principles are expected to remain stable across the roadmap.

### 2.1 Code is the source of truth

Users and agents edit MindPPT source.

Excalidraw is a projection of compiled state and must not become a second semantic source.

### 2.2 Cordis is foundational

Major capabilities are Cordis plugins or services.

Useful runtime behavior should naturally participate in the Cordis lifecycle rather than exist as a parallel framework-independent application core.

### 2.3 React + TypeScript owns host UI

Web and DSH-side graphical interfaces are written in React + TypeScript.

React owns UI composition. It does not own presentation semantics or document state.

### 2.4 Excalidraw owns canvas rendering

Excalidraw is the drawing and viewport backend.

MindPPT source must not expose raw Excalidraw JSON as an authoring format.

### 2.5 Open Content, Closed Structure

Core owns the document structure:

```text
deck
slide
tree
link
path
```

Third-party plugins may extend content inside slides, but must not redefine slide ownership, primary tree semantics, soft-link semantics, or path semantics.

### 2.6 Unknown Content Is Valid

Missing an optional content plugin must not make a document syntactically invalid.

Unknown extension content is preserved as raw source and rendered through a generic fallback.

### 2.7 Capability is not grammar

Loading a plugin such as `dsh-mindppt-latex` must not change the outer MindPPT grammar.

The core parser recognizes generic extension content. Plugins change how that content is interpreted or rendered.

### 2.8 Layout is content-agnostic

Layout operates on semantic nodes and boxes.

A layout should not need to know whether a node is Markdown text, an image, LaTeX, Mermaid, or another extension type.

### 2.9 Camera is content-agnostic

Camera behavior depends on slide geometry and topology, not slide content types.

### 2.10 Ponytail principle

Do not create packages, services, registries, or abstractions before there is a concrete functional or lifecycle boundary.

Implementation phases inside one compiler plugin remain internal until a real independent lifecycle exists.

## 3. Language direction

MindPPT uses a hybrid language.

### 3.1 Structure: Mermaid-like

Topology uses compact Mermaid-like graph notation:

```mindppt
tree LR {
  intro --> market
  market --> product
}

link product -.-> summary
```

MindPPT does not attempt to implement full Mermaid syntax in its outer language.

### 3.2 Layout: MindPPT DSL

Presentation-specific layout uses explicit MindPPT constructs:

```mindppt
slide customer {
  layout two-column

  left {
    ...
  }

  right {
    ...
  }
}
```

### 3.3 Content: Markdown profile

Ordinary slide content uses a deliberately small Markdown profile.

Inside a slide or layout slot, Markdown is the default interpretation. MindPPT structural/layout keywords are recognized only at structural block-start positions outside fenced blocks. A closing brace ends a structural block only when it appears as the structural closing line outside a fence.

This keeps ordinary Markdown, formulas, code, and graph-looking text opaque to the outer parser unless they deliberately enter a MindPPT DSL construct.

Example:

```markdown
# German Outdoor Market

## 2026 opportunity review

Demand remains seasonal.

- Premium products gain share
- Online channels continue growing
```

The first profile should support only the blocks required by presentations.

Initial target:

```text
# heading
## heading
paragraph
- unordered list
1. ordered list
fenced block
```

Full CommonMark compatibility is not a goal.

HTML, blockquotes, complex nested lists, reference links, and other syntax remain deferred until a real presentation use case requires them.

### 3.4 Extension content

Fenced blocks are the default extension envelope:

````markdown
```latex
e^{i\pi} + 1 = 0
```
````

The core parser should preserve:

```ts
interface ExtensionNode {
  kind: 'extension'
  type: string
  raw: string
}
```

Without a matching plugin:

```text
ExtensionNode
  -> generic raw text/code fallback
```

With a matching plugin:

```text
ExtensionNode
  -> Cordis extension capability
  -> semantic/render handler
  -> Excalidraw-compatible output
```

Raw payload must never be discarded.

## 4. Delivery discipline

Every milestone should ship through the same chain:

```text
.mindppt fixture
    |
    v
parser / structure test
    |
    v
renderer test
    |
    v
React playground
    |
    v
visible Excalidraw result
    |
    v
CI
```

Engineering constraints:

- prefer milestones below roughly 1000 lines of new implementation code;
- keep source files focused and preferably below 200 lines;
- every new syntax capability should have an end-to-end fixture;
- avoid parser-only features that cannot yet be observed through delivery;
- keep semantic structures deterministic;
- preserve stable identities where practical;
- add abstractions only when the current milestone creates a real need.

## 5. Milestones

## M0 — Hello World Runtime

Status: complete

Purpose: prove the complete runtime and delivery path before building a real parser.

Source:

```mindppt
mindppt

slide hello {
  title "Hello World"
}
```

Delivered:

- Cordis parser service;
- Cordis Excalidraw renderer service;
- React + TypeScript playground;
- official Excalidraw Skeleton delivery path;
- 1600x900 white slide surface;
- subtle slide shadow;
- centered `Hello World` title;
- typecheck, tests, plugin builds, and Vite build in CI.

M0 intentionally uses a minimal temporary grammar.

It does not establish the final content syntax.

---

## M1 — Structural Parser + Two Slides + Tree

Status: complete

Purpose: replace the bootstrap regex with the first real parser and prove spatial topology.

Target source shape:

```mindppt
mindppt

tree LR {
  intro --> market
}

slide intro {
  # Introduction
}

slide market {
  # Market
}
```

Compiler work:

- tokenizer;
- small recursive-descent structural parser;
- `mindppt`, `slide`, `tree`, and `-->`;
- the minimum Markdown content needed for the visible anchor: `# heading` only;
- stable slide semantic IDs;
- source ranges;
- basic reference resolution;
- deterministic two-node spatial layout.

The tokenizer must understand fenced blocks well enough that braces, arrows, and other structural tokens inside a fence remain opaque content.

Renderer work:

- multiple slide surfaces;
- primary tree edge;
- stable Excalidraw IDs derived from semantic IDs.

Visible acceptance:

> The web playground displays two PPT slides connected by one primary tree arrow.

Explicit non-goals:

- the full Markdown profile beyond the single heading needed by M1;
- soft links;
- paths;
- advanced diagnostics;
- generic extension registry;
- complex layout.

---

## M2 — Markdown Content Profile + Extension Fallback

Status: complete

Purpose: establish the long-term content model by extending M1's single-heading support into the first intentional MindPPT Markdown Profile.

Support:

- `#` -> title semantic node;
- `##` -> subtitle semantic node;
- paragraph -> text semantic node;
- unordered list -> list semantic node;
- ordered list -> list semantic node;
- fenced block -> extension semantic node.

Example:

````mindppt
slide math {
  # Euler Identity

  A compact mathematical example.

  ```latex
  e^{i\pi} + 1 = 0
  ```
}
````

Without a LaTeX plugin, the formula must still render as readable fallback content.

Architecture established here:

```text
Core Structure Node
Content Node
  |- Markdown semantic nodes
  |- ExtensionNode
```

Visible acceptance:

> A normal title/body/list slide renders correctly, and an unknown fenced extension remains visible rather than failing compilation.

Explicit non-goals:

- complete CommonMark;
- inline rich-text layout;
- extension-specific parser registration;
- LaTeX rendering.

---

## M3 — Code Editor + Live Compile

Status: complete

Purpose: turn the static playground into the actual authoring development loop.

Add the `code-editor` Cordis plugin.

Runtime path:

```text
edit source
    |
    v
compile
   / \
success error
 |       |
 v       v
new      diagnostics
scene    keep last-good scene
```

Required behavior:

- source editing in React UI;
- at least one browser-level smoke test for the edit -> compile -> visible update path;
- compile on source change;
- diagnostics surfaced to UI;
- temporary invalid input does not blank the canvas;
- parser tracks current source, diagnostics, and last successful structure.

Visible acceptance:

> Editing a slide title updates the Excalidraw canvas; introducing an incomplete block shows an error while keeping the last valid rendering.

Source mapping begins to become operational here for diagnostics and editor navigation.

---

## M4 — Branching MindMap + Validation + Spatial Layout

Status: complete

Purpose: prove the mind-map model beyond a linear pair of slides.

Support:

- branching trees;
- `LR`, `RL`, `TB`, `TD`, `BT`;
- deterministic tree layout;
- duplicate slide diagnostics;
- unknown slide references;
- duplicate tree edges;
- multiple parents;
- tree cycles;
- unreachable-slide warning.

Delivered:

- deterministic branching layout for `LR`, `RL`, `TB`, `TD`, and `BT`;
- `TD` is the top-down alias of `TB`;
- duplicate slide, unknown reference, duplicate edge, multiple-parent, and cycle errors;
- non-blocking unreachable-slide warnings;
- direction-correct primary tree arrow anchors in Excalidraw;
- browser-level proof that direction changes update the live canvas.

Tree layout uses only the primary tree.

Soft links do not exist yet.

Visible acceptance:

> A five-to-seven-slide branching presentation renders as a stable spatial mind map.

A small content edit should not cause unrelated semantic IDs or positions to change without reason.

---

## M5 — Camera Navigation

Status: in progress

Current first slice:

- Cordis-native `camera` service owns transient current-slide navigation state;
- direct focus plus primary-tree parent/child navigation;
- current slide geometry and topology view exposed without React re-parsing the tree;
- navigation request revision separates viewport commands from source recompiles;
- React host projects focus to the stable slide surface through Excalidraw 0.18.0;
- movement is instant/single-step for this slice.

The default `zoom out -> travel -> zoom in` choreography remains deferred until the single-step browser result is evaluated.

Purpose: prove that presentation is traversal over spatial topology.

Add the `camera` Cordis plugin.

Camera consumes:

```text
slide geometry
tree relationships
current slide
target slide
viewport
```

Initial transitions:

- parent -> child;
- child -> parent;
- direct target focus.

Default movement:

```text
focus current
-> zoom out
-> travel
-> zoom in
```

React UI adds only minimal presentation controls.

Visible acceptance:

> A user can select a slide and navigate through parent/child relationships with spatial camera movement.

Camera must remain independent from content types.

---

## M6 — Layout + Image + Asset Pipeline

Purpose: make ordinary business presentation pages practical.

Initial layout presets:

- `hero`;
- `title-content`;
- `two-column`.

Initial layout primitives:

- named slots such as `left` and `right`;
- simple row/column behavior only where required by the presets.

Image support:

```markdown
![Customer](./assets/customer.png)
```

Default image behavior can use `contain`.

Advanced fit behavior may use MindPPT component/layout metadata rather than extending Markdown syntax.

Asset work:

- resolve paths relative to the MindPPT document;
- load local assets into the Excalidraw file map;
- preserve asset identity across recompiles where practical;
- treat remote URL loading as runtime policy, not a language guarantee.

Visible acceptance:

> A two-column slide with text on one side and an image on the other renders correctly.

Layout remains content-agnostic.

---

## M7 — Core Table + Chart

Purpose: support common data-driven presentation pages.

Tables remain core semantic content.

Do not add Markdown table syntax in v0.

Reason:

- avoid a second competing table representation;
- avoid expanding the Markdown profile into GFM;
- preserve structured data for layout and QA.

Initial table support:

- header row;
- rows;
- string and numeric cells;
- equal-width columns;
- theme-level basic styling.

Charts remain semantic until renderer lowering.

Initial chart types:

- bar;
- line;
- radar.

Visible acceptance:

> A data-analysis slide can contain one table and one native Excalidraw-compatible chart.

Deferred:

- formulas;
- merged table cells;
- spreadsheet editing;
- pie/scatter/waterfall/funnel;
- secondary axes.

---

## M8 — Soft Links + Presentation Paths

Purpose: complete the core nonlinear presentation model.

Soft links:

```mindppt
link competitor -.-> summary
```

Paths:

```mindppt
path main {
  intro
  market
  customer
  product
  summary
}
```

Semantic separation becomes explicit:

```text
Tree      = canonical hierarchy and spatial skeleton
Soft Link = cross-branch semantic relation
Path      = ordered presentation route
```

Rules:

- soft links do not change tree ownership;
- soft links do not drive primary tree layout;
- paths may revisit slides;
- multiple paths may coexist;
- camera can use a distinct transition for arbitrary or soft-link jumps.

Visible acceptance:

> The same mind map can be played through at least two different saved presentation routes.

---

## M9 — Content Plugin Contract + LaTeX Reference Plugin

Purpose: prove open content through a real external capability.

The core parser continues to emit generic `ExtensionNode` values.

It does not gain LaTeX grammar.

Add the smallest Cordis-native extension capability required by a real plugin.

Reference plugin:

```text
dsh-mindppt-latex
```

Expected lifecycle:

```text
plugin not loaded
  -> latex fence renders as generic fallback

plugin loaded
  -> latex ExtensionNode handled by plugin
  -> formula output
  -> Excalidraw-compatible rendering

plugin unloaded
  -> registration disappears with Cordis fiber
  -> fallback remains valid
```

Possible plugin capabilities:

- extension type declaration;
- optional semantic transformation;
- renderer;
- optional size/layout hint.

Do not introduce a global singleton registry.

Capability discovery should expose the extension types currently available in the runtime.

If multiple plugins claim the same extension type, the runtime should report a capability conflict rather than silently choosing a last-loaded handler.

If useful, a second reference plugin such as Mermaid may be added to verify that the contract is not LaTeX-specific.

Mermaid-like tree syntax remains core regardless of whether a Mermaid content plugin exists.

Visible acceptance:

> The same source file remains valid with or without the LaTeX plugin; only rendering capability changes.

---

## M10 — DSH Integration + Agent Authoring

Purpose: expose the mature MindPPT authoring loop to DSH and agents.

Add:

- `dsh-mindppt-sidebar`;
- `dsh-capability`.

The sidebar reuses the existing React + TypeScript components and Cordis services.

The capability layer exposes:

- current source;
- source patches;
- diagnostics;
- structure inspection;
- current content capabilities;
- preview/render feedback;
- language guidance and examples.

Agent loop:

```text
inspect source
    |
    v
inspect runtime capabilities
    |
    v
patch source
    |
    v
compile
    |
    +---- error -> diagnostics -> revise
    |
    v
render
    |
    v
inspect result
    |
    v
revise
```

At this stage, source maps and stable semantic IDs should support precise edits rather than full-file regeneration.

Visible acceptance:

> A DSH agent can read an existing MindPPT document, make a local source change, inspect compiler feedback, and see the updated presentation without manipulating Excalidraw JSON.

## 6. Cross-cutting capabilities

Some capabilities grow across several milestones rather than belonging to one isolated feature.

### 6.1 Stable semantic identity

Start in M1 and preserve throughout the roadmap.

Examples:

```text
slide:intro
slide:intro/title:0
slide:market/list:0
```

Named nodes should use their explicit IDs.

Unnamed nodes should derive deterministic IDs from stable structural paths.

### 6.2 Source mapping

Start with structural ranges in M1.

Expand in M2-M3 to Markdown content and diagnostics.

By M10, source mapping should support precise agent patches and editor navigation.

### 6.3 Diagnostics

Grow incrementally:

```text
M1 structural syntax/reference errors
M3 live editing diagnostics
M4 graph semantic validation
M6 layout/asset warnings
M7 table/chart validation
M9 extension capability warnings
```

### 6.4 Last-good rendering

Required once live editing begins.

A temporary syntax error must not erase the last successful presentation.

### 6.5 Deterministic geometry

Layout output should be deterministic for identical source and runtime capabilities.

This supports tests, selection continuity, camera behavior, and future diffing.

## 7. Deferred backlog

The following are intentionally outside the core roadmap unless a concrete use case promotes them:

- full CommonMark compatibility;
- inline mixed rich text;
- arbitrary HTML or CSS;
- native Excalidraw JSON authoring;
- direct canvas editing as semantic source;
- theme authoring DSL;
- large icon-provider system;
- arbitrary camera keyframes;
- animation timeline authoring;
- SmartArt compatibility;
- audio/video;
- PPTX fidelity or round-trip import/export;
- every Mermaid diagram type;
- every chart family;
- spreadsheet formulas;
- merged table cells;
- multiple independent primary trees;
- collaborative editing protocol;
- generalized third-party extensions to document topology.

## 8. v0 completion target

MindPPT v0 is considered architecturally proven when one project can demonstrate:

- at least six slides;
- a branching primary tree;
- Markdown-authored ordinary slide content;
- semantic layout;
- local image assets;
- one table;
- one bar or line chart;
- one unknown extension rendered through fallback;
- one installed extension rendered through a plugin;
- one soft link;
- two presentation paths;
- camera traversal between spatial slides;
- live source editing with diagnostics and last-good rendering;
- stable semantic IDs and usable source ranges;
- DSH/Agent source-editing loop;
- no raw Excalidraw JSON required from authors or agents.

This target validates the MindPPT model rather than attempting to reproduce PowerPoint feature parity.
