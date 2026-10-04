# MindPPT Roadmap

Status: accepted v0 implementation roadmap  
Baseline: M5 merged to `main`  
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

Status: complete

Purpose: prove that presentation is traversal over spatial topology.

M5.1 — semantic focus + topology navigation:

- Cordis-native `camera` service owns transient current-slide navigation state;
- direct target focus plus primary-tree parent / child navigation;
- current slide geometry and topology view exposed without React re-parsing the tree;
- `CameraFocusRequest` carries `revision`, target `slideId`, and the optional semantic `fromSlideId` captured before current-slide mutation;
- request revision separates viewport commands from source recompiles;
- compile failures preserve last-good scene and camera state;
- successful recompiles preserve the current slide when it still exists and clear camera focus state when it is removed.

M5.2 — viewport choreography:

- React / Excalidraw host owns a local cancellable sequencer; the camera service remains free of Excalidraw state and animation timing;
- normal slide-to-slide movement is `zoom out -> travel -> zoom in`;
- zoom-out fits the source slide at `0.55` viewport factor for `220ms`;
- travel moves to the target center at the zoomed-out scale for `340ms`;
- zoom-in fits the target slide at the M5 framing factor `0.85` for `220ms`;
- first focus from the overview skips source zoom-out and performs `travel -> zoom in`;
- repeated same-slide focus performs only the animated final framing;
- every phase resolves `slide:<id>/surface` from the current Excalidraw scene immediately before use, so successful live recompiles do not leave stale element objects queued in the transition;
- missing source surface degrades to target travel plus final focus, while a missing target stops the transition safely;
- React effect cleanup cancels pending host sequencing when a newer request arrives or the component unmounts; the next `scrollToContent()` call cancels the previous Excalidraw RAF animation;
- fixed local timing keeps the normal transition below one second without introducing an animation framework or configuration system.

Camera consumes:

```text
slide geometry
tree relationships
current slide
target slide
viewport
```

Supported navigation:

- parent -> child;
- child -> parent;
- direct target focus;
- repeated same-slide refocus.

Initial load remains the complete mind-map overview. Source recompiles do not automatically refocus the current slide.

Visible acceptance:

> A user can select a slide and navigate through parent/child relationships with animated spatial camera movement, and a newer navigation request wins over any older in-flight choreography.

Camera remains independent from content types.

---

## M6 — Layout + Image + Asset Pipeline

Status: complete

Purpose: make ordinary business presentation pages practical.

Delivered:

- `hero` preset with compiler-owned deterministic centered semantic placement;
- `title-content` preset with a distinct title area and ordinary Markdown content area;
- `two-column` preset with compiler-owned deterministic semantic placement;
- named `left` / `right` slot semantics for two-column;
- Markdown image nodes with source ranges and stable semantic IDs;
- Excalidraw image skeleton lowering with deterministic file IDs;
- document-relative local asset resolution in the browser host;
- Excalidraw `BinaryFiles` delivery;
- semantic placement boxes that define preset position, width, and basic vertical rhythm without approximating font metrics;
- font-ready browser reconversion so the first stable scene uses the same Excalidraw measurement as later source recompiles;
- runtime-local asset revision memoization so unchanged bytes are not re-digested;
- mounted `BinaryFiles` pruning so the Excalidraw host matches the current logical snapshot;
- missing / malformed / non-local asset warnings without breaking last-good rendering;
- canonical fixtures covering all three presets and the focused two-column asset path;
- Chromium-visible smoke coverage for the three presets, live recompilation, images, last-good, and M5 Camera regression.

Initial layout presets:

- `hero`;
- `title-content`;
- `two-column`.

Authoring remains deliberately small:

```mindppt
slide cover {
  layout hero

  # Product Direction
  ## 2026 review

  A short supporting statement.
}

slide summary {
  layout title-content

  # Executive Summary

  The title occupies its own semantic area.

  - Ordinary Markdown remains ordinary content
  - Geometry is deterministic from the slide box
}
```

Named slots remain specific to the preset that needs them:

```mindppt
slide customer {
  layout two-column

  # Customer Profile

  left {
    ...
  }

  right {
    ...
  }
}
```

Layout remains content-agnostic. The compiler/layout layer owns presentation semantics: slide-relative position, available width, preset regions, and basic block rhythm. It does not reimplement browser or Excalidraw font measurement, and it does not reject text based on predictive glyph budgets. Excalidraw 0.18 owns the actual text measurement during conversion. Because its scene fonts load asynchronously, the browser host reconverts the unchanged semantic scene after those fonts settle so cold-start geometry matches later recompiles without requiring a user edit. Concrete overflow behavior remains deferred until a real presentation case requires it. Excalidraw frames remain grouping containers rather than visual slide boundaries.

Image support:

```markdown
![Customer](./assets/customer.png)
```

Default image behavior uses the deterministic current box. Broader image-fit behavior is deferred to the backlog and should return only when a concrete presentation use case requires it.

Asset work:

- resolve paths relative to the MindPPT document;
- load local assets into the Excalidraw file map;
- keep semantic image identity separate from binary content-revision identity;
- reuse unchanged binary revisions without re-hashing their bytes on text-only recompiles;
- prune mounted orphan revisions when assets are replaced or removed;
- preserve last-good/version consistency through asset warnings and compile failures;
- treat remote URL loading as runtime policy, not a language guarantee.


Visible acceptance:

> Hero, title-content, and two-column slides compile from MindPPT source into visibly distinct deterministic layouts, including a two-column slide with text and a local image.

M6 does not introduce a generic layout engine, constraint solver, theme system, component registry, asset registry, or CSS-like layout DSL.

---

## M7 — Core Structured Table + Chart

Status: complete

Purpose: prove the first real data-analysis presentation slice through the existing source -> semantic structure -> layout -> Excalidraw delivery path.

M7.1's structured table + single-series bar chart satisfies this purpose and the v0 requirement for one table plus one bar or line chart. The current repository has no concrete line-chart presentation requirement, accepted fixture need, unresolved M7 acceptance item, or downstream M8-M10 dependency. M7 is therefore complete at the current product/v0 boundary.

Tables are core semantic content. Charts remain semantic until renderer lowering.

Do not add Markdown/GFM table syntax in v0. Table and chart authoring are MindPPT core structured content, not fenced extensions. This keeps structured data available for validation, deterministic identity, layout, rendering, and later agent edits without creating a competing Markdown representation or overloading the generic extension envelope.

The authoring direction should be explicit enough to support the first slice without freezing a broader grammar or option schema prematurely. Conceptually:

~~~mindppt
table {
  header [...]
  row [...]
}

chart bar {
  labels [...]
  values [...]
}
~~~

M7.1 now fixes only this minimal grammar: `header`, repeated `row`, `labels`, and `values` statements whose array payloads are JSON literals. No option schema is introduced.

### M7.1 — Table + Single-Series Bar Vertical Slice

Status: complete

Delivered grammar:

~~~mindppt
table {
  header ["Channel", "Orders", "Revenue"]
  row ["Direct", 184, 42600]
  row ["Partner", 121, 31900]
}

chart bar {
  labels ["Direct", "Partner"]
  values [184, 121]
}
~~~

Array payloads are JSON literals. The parser keeps table cells and chart data structured, diagnostics stay source-ranged, the compiler owns table-cell and bar geometry inside the assigned content box, and `canvas-excalidraw` mechanically lowers that geometry. The canonical `examples/m7-data-analysis.mindppt` fixture exercises both constructs together in the existing two-column layout through the live authoring and Chromium path.


The delivered M7.1 slice integrates all three parts in one real presentation page:

~~~text
structured core table
        +
single-series bar chart
        +
existing two-column layout
~~~

It is not complete if table and chart exist only as isolated parser features.

Table v1 commits to:

- one header row;
- rows;
- string cells;
- numeric cells;
- equal-width columns;
- deterministic semantic identity;
- source ranges;
- simple fixed presentation styling implemented by the current core renderer.

Table v1 explicitly does not commit to:

- Markdown/GFM table syntax;
- formulas;
- merged cells;
- spreadsheet editing;
- arbitrary wrapped-cell auto layout;
- auto-fit or shrink-to-fit;
- theme APIs.

Chart v1 commits to:

- chart type: bar;
- one categorical label axis;
- one numeric series;
- semantic numeric data;
- deterministic semantic IDs;
- compiler-owned chart region and bar geometry;
- mechanical lowering to Excalidraw-compatible primitives.

Chart v1 explicitly does not commit to:

- line chart without a concrete presentation use case;
- radar;
- pie, scatter, waterfall, or funnel charts;
- multiple axes;
- advanced legends;
- a generic chart engine;
- a chart-library abstraction.

Architecture alignment:

- table and chart extend the core `ContentNode` semantic model;
- layout remains content-agnostic and only assigns each content node a placement region;
- layout does not inspect table cells or chart series to decide slide topology;
- the compiler owns presentation semantic placement and chart/bar geometry;
- the renderer mechanically lowers semantic table/chart nodes into Excalidraw-compatible primitives;
- simple fixed table/chart presentation styling stays local to the current core renderer and does not establish a theme API;
- Excalidraw continues to own actual font measurement/render geometry; M7 must not recreate precise font measurement in the compiler;
- Camera remains unaware of table/chart internals;
- the asset pipeline has no M7 coupling;
- no new package, service, registry, chart engine, or framework is introduced unless implementation reveals a real independent lifecycle.

Visible acceptance:

> A two-column MindPPT slide contains a structured table on one side and a single-series bar chart on the other. Editing table or chart source data updates the visible Excalidraw scene through the existing live-authoring path while stable semantic identity, source ranges, last-good rendering, and Camera behavior remain intact.

### Deferred Follow-up — Line Chart (Evidence-Gated)

Status: deferred

Line chart is not a remaining M7 acceptance item or a v0 blocker. It should return only when a concrete presentation use case requires it.

If that evidence appears, a line chart must reuse the proven semantic/rendering boundary rather than justify a generic chart framework.

Deferred from the completed M7 scope:

- line chart;
- radar;
- theme system and theme APIs;
- Markdown/GFM tables;
- formulas;
- merged cells;
- spreadsheet editing;
- advanced cell auto-layout;
- auto-fit and shrink-to-fit;
- multi-series or general chart frameworks;
- pie, scatter, waterfall, and funnel charts;
- secondary axes;
- advanced legends.

Broader table/chart features should return only when concrete presentation use cases justify them.

---

## M8 — Soft Links + Presentation Paths

Status: planned

Purpose: complete the core nonlinear presentation model as one end-to-end vertical slice through the existing source -> semantic structure -> renderer / Camera -> browser delivery path.

M8 must deliver together:

~~~text
core SoftLink semantics
        +
core PresentationPath semantics
        +
existing Camera path playback
        +
visible soft-link relation
        +
two saved routes in Chromium
~~~

This is one vertical slice, not separate parser, graph, route, or animation projects.

Authoring direction remains:

~~~mindppt
link competitor -.-> summary
~~~

and:

~~~mindppt
path main {
  intro
  market
  size
  market
  summary
}
~~~

Semantic separation is strict:

~~~text
Tree      = canonical hierarchy + parent/child ownership + spatial skeleton
Soft Link = visible directed cross-branch semantic relation
Path      = ordered presentation playback only
~~~

### M8 SoftLink semantics

SoftLink is core document structure. It is not slide content, an extension block, or a plugin capability.

M8 requires:

- a directed from -> to semantic relation;
- source and target to resolve to distinct existing slides;
- stable deterministic semantic identity and a usable source range;
- an error when source and target are the same slide;
- an error for an identical duplicate from -> to relation;
- the reverse to -> from relation to remain a separate valid relation when its endpoints are distinct;
- no change to primary-tree parent ownership;
- no participation in primary-tree spatial layout;
- renderer lowering that makes the relation visibly distinct from primary-tree edges without moving slides.

M8 does not introduce a generic graph model or topology abstraction layer.

### M8 PresentationPath semantics

PresentationPath is named core document structure.

M8 requires:

- a unique path name / semantic ID;
- a non-empty ordered sequence of slide occurrences;
- every occurrence to resolve to an existing slide;
- repeated slide IDs to remain valid distinct occurrences;
- multiple named paths to coexist;
- deterministic semantic identity and source ranges for the path and its occurrences.

A path step may follow a primary-tree edge, follow a soft link, or jump to any other slide. M8 performs no path adjacency validation and no cycle validation.

Paths do not change tree ownership or world layout and are not rendered as another canvas topology edge set.

M8 does not introduce route optimization, graph-derived routes, a route registry, or a generic navigation engine.

### M8 Camera path playback

Path playback extends the existing Cordis-native Camera transient navigation boundary. M8 does not add a route/path service.

The minimum playback state must express:

~~~text
selectedPathId
current path occurrence index
currentSlideId
~~~

The occurrence index is the authoritative route cursor. It must never be inferred from currentSlideId, because one path may contain the same slide more than once.

Minimum deterministic behavior:

- selecting a path starts at its first occurrence;
- next moves to the next occurrence when one exists;
- previous moves to the previous occurrence when one exists;
- two consecutive or separated occurrences of the same slide remain distinct path steps;
- focusing a path occurrence ultimately reuses the existing Camera focus request and M5 geometry-based viewport choreography.

Non-path navigation exits active path playback context instead of trying to reconcile a cursor. This applies to direct focus, parent/child navigation, and following a soft link.

Following a soft link must be a real semantic interaction:

~~~text
current slide
-> declared outgoing SoftLink from compiled semantics
-> linked target slide
-> existing Camera focus request
-> existing M5 choreography
~~~

The user must be able to follow at least one actual outgoing SoftLink from the current slide. The linked target must come from the compiled SoftLink semantics; UI code must not hard-code the target or re-parse authoring source to recover it. The follow action then reuses the existing semantic slide-focus behavior and M5 choreography, and because it is non-path navigation it exits active path playback context.

M8 does not freeze the public API shape for exposing linked targets or triggering the follow action. It does not require canvas-edge clicking, a new navigation service, or a soft-link-specific / arbitrary-jump transition family.

### Recompile and last-good semantics

The existing last-good contract remains authoritative.

- compile failure keeps the last-good structure and the current Camera/path playback state;
- after a successful recompile, active path playback is preserved only when the selected path still exists, the current occurrence index is still in range, and that exact occurrence still resolves to the current slide;
- otherwise Camera clears only the active path playback context safely, while ordinary current-slide preservation follows the existing M5 recompile rules.

M8 does not add cursor reconciliation or route-migration machinery.

### Validation

M8 validation must at least cover:

Soft links:

- unknown source slide;
- unknown target slide;
- self-link relation where source == target;
- duplicate identical relation.

A -> B and B -> A remain two independent valid relations. M8 does not implement self-loop routing, loop geometry, or special self-link renderer behavior.

Paths:

- duplicate path ID;
- empty path;
- unknown slide occurrence.

Repeated occurrences are valid. M8 adds no path-cycle validation, path-adjacency validation, route optimization, or automatic graph-derived route generation.

### Canonical fixture

M8 implementation must evolve the existing multi-slide presentation into a real canonical fixture rather than add an isolated syntax-only fixture.

The fixture must include:

- a branching primary tree;
- one visible soft link;
- two named presentation paths;
- different traversal order between the two paths;
- at least one path containing a repeated slide occurrence.

This fixture should remain the evolving v0 "one project demonstrates everything so far" proof.

### Renderer and UI boundary

Primary-tree rendering remains unchanged.

The renderer may lower SoftLink semantics into a visually distinct relation, but must not derive or mutate slide geometry from soft links. Paths have no canvas-edge rendering. The renderer does not parse link/path authoring source.

The playground needs only the minimum controls required to prove the semantic capability:

- path selection;
- previous;
- next;
- at least one minimal user-visible SoftLink affordance that follows an actual declared outgoing relation from the current slide.

That SoftLink affordance must obtain its linked target from compiled SoftLink semantics. It must not re-parse source, hard-code a target, or substitute an arbitrary direct slide selector for SoftLink follow acceptance.

M8 does not design a presentation-player framework, route timeline/editor, transition framework, path registry, or new navigation service.

Visible acceptance:

> In the same canonical mind map, primary-tree geometry remains identical while at least one soft link is visibly distinct from tree edges. The user can select either of two saved paths and move previous/next through their ordered occurrences; the two paths produce different traversal order, and a repeated slide occurrence is traversed as a distinct step. With `competitor -.-> summary` declared and `competitor` as the current slide, the user can use the SoftLink affordance to navigate to `summary`; the target is derived from compiled SoftLink semantics, and an ordinary arbitrary slide selector cannot substitute for this acceptance. The follow action reuses the existing Camera focus behavior and M5 choreography and exits active path playback context. Live source edits continue to publish valid changes, while invalid source preserves diagnostics, the last-good structure, and active Camera/path state.


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
- generalized third-party extensions to document topology;
- broader image-fit behavior beyond the deterministic current image box, to be reconsidered only when a concrete presentation use case requires it.

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
