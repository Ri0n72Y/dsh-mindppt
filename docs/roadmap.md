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

With a matching renderer:

```text
same ExtensionNode
  -> Cordis-scoped renderer capability
  -> Excalidraw-compatible specialized rendering
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

Status: complete

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

Delivered by the M8 implementation slice:

- core `link A -.-> B` and named `path` parsing with whole-document resolution;
- deterministic SoftLink, path, and occurrence identities with source ranges;
- SoftLink endpoint/self/duplicate validation and path name/empty/reference validation;
- dashed directed SoftLink lowering from existing slide geometry only;
- occurrence-index Camera playback with path select / previous / next;
- outgoing SoftLink follow derived from compiled semantics and reused focus requests;
- exact-occurrence preserve/clear behavior across successful recompiles;
- a six-slide branching canonical fixture retaining M6 image/layout and M7 table/chart coverage;
- Chromium-visible controls for two saved routes and declared SoftLink follow.

No graph, route, navigation, transition, path-registry, or presentation-player framework was added.

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

Status: complete
Post-M9 Manual Acceptance Gate: complete
M0-M9 standalone baseline: accepted

Purpose: prove open content as one runtime capability-lifecycle vertical slice without changing grammar, semantic structure, or compiler-owned geometry.

Delivered implementation keeps registration inside `mindpptCanvas`, binds renderer cleanup to the registering Cordis fiber, reprojects the same last-successful structure on capability changes, exposes active renderer types from real registration state, and ships `dsh-mindppt-latex` as the reference renderer. Independent review, merge, focused post-M9 fixes, and the integrated real-machine M7/M8/M9 acceptance pass are complete; M0-M9 is now the accepted standalone baseline.

M9 delivers together:

~~~text
existing generic ExtensionNode semantics
        +
runtime extension renderer capability
        +
Cordis-scoped registration lifecycle
        +
same-source rerender on capability change
        +
active renderer-type discovery
        +
dsh-mindppt-latex reference plugin
~~~

This is not a parser milestone, generic extension platform, semantic-transformation framework, or layout-plugin architecture.

### M9 semantic boundary

The core parser continues to emit the same generic `ExtensionNode` whether or not any extension renderer is loaded.

For one unchanged source, capability load/unload must not change:

- node kind;
- extension type;
- raw payload;
- source range;
- semantic identity;
- slide-local `x / y / width / height`;
- slide world geometry;
- tree, SoftLink, or PresentationPath semantics.

Capability lifecycle changes only the canvas rendering projection. It does not register new outer grammar, mutate source, transform the node into a new compiler semantic type, re-enter slide layout, request new compiler geometry, or change Camera semantic state.

M9 v0 establishes one capability only:

~~~text
extension renderer capability
~~~

Semantic transformation, sizing hints, and layout hints remain deferred until a concrete extension cannot work inside the existing compiler-owned semantic box.

### Capability ownership and registration

The existing `mindpptCanvas` / `canvas-excalidraw` responsibility owns the minimum runtime-local extension-renderer registration surface because rendering projection is the only current consumer.

M9 does not require a standalone extension registry/service. A new service is justified only if implementation discovers a concrete independent lifecycle blocker that prevents this acceptance.

The minimum registration semantics are:

~~~text
extension type -> one active renderer capability
~~~

A renderer consumes the resolved generic `ExtensionNode`, its existing semantic geometry, and only the minimum context required for mechanical lowering. It returns Excalidraw-compatible specialized rendering.

Exact TypeScript method names and signatures remain an implementation detail.

Registration state must be:

- runtime-local, never module-global;
- deterministic;
- bound to the registering Cordis fiber lifecycle.

### Cordis lifecycle and same-source rerender

Lifecycle behavior is:

~~~text
plugin load
  -> registration becomes active

plugin unload / fiber dispose
  -> registration automatically disappears
~~~

The host does not manually unregister plugin-owned handlers.

Capability-set changes must rebuild the rendering projection from the current last-successful `MindPptStructure` without editing source or invoking parser compilation.

The canonical lifecycle acceptance fixes the same:

~~~text
source
MindPptStructure
ExtensionNode
semantic ID
sourceRange
x / y / width / height
~~~

and verifies:

~~~text
no plugin
  -> generic fallback visible

load dsh-mindppt-latex
  -> specialized formula rendering visible

unload plugin
  -> generic fallback restored
~~~

If this requires a minimal canvas scene-change notification, M9 may add that lifecycle hook. It must not grow into a generic reactive framework, event-bus redesign, projection scheduler, or runtime dependency graph.

Plugin load/unload must not:

- create a new parser compile revision;
- change parser diagnostics;
- modify source;
- update the last-good semantic structure;
- reset Camera;
- change current slide or active path occurrence;
- emit a navigation request.

M9 therefore distinguishes compile-state changes from projection-capability changes.

### Fallback, handler failure, and conflict

Unknown extension types are always valid.

When no matching renderer is active, the existing generic raw fallback remains visible. Raw payload remains preserved regardless of specialized rendering availability.

If a matching renderer fails on one payload, the presentation must not blank or fail as a whole. The minimum safe behavior is:

~~~text
specialized render failure
  -> generic extension fallback
~~~

Existing minimal warning mechanisms may be reused, but M9 does not require a new runtime diagnostics subsystem.

At most one active renderer may claim an extension type.

For a duplicate claim:

~~~text
renderer A claims "latex"
renderer B attempts to claim "latex"
~~~

the result must be deterministic:

- B registration does not become active;
- A remains active;
- no silent last-loaded-wins behavior;
- B failure/disposal cannot remove or poison A.

M9 adds no priorities, overrides, provider ranking, fallback chain, or multi-handler composition. Duplicate claims are runtime capability conflicts, not parser grammar errors.

### Capability discovery

M9 exposes the currently active extension renderer types from actual runtime registration state.

For example:

~~~text
[]
load latex -> ["latex"]
unload latex -> []
~~~

Discovery must not be derived from source fence types, parser-known extension types, installed packages, or a hard-coded list.

M9 does not define the M10 Agent capability schema.

### LaTeX reference plugin

M9 adds one independent Cordis plugin/package:

~~~text
dsh-mindppt-latex
~~~

It proves that the generic contract can be consumed by a real external capability.

The plugin:

- claims only `latex`;
- does not modify `code-parser`;
- does not add LaTeX outer grammar;
- consumes `ExtensionNode.raw`;
- preserves the existing semantic content box;
- produces visibly specialized formula rendering;
- follows Cordis registration lifecycle.

The browser-visible specialized result must be materially different from the generic fallback:

~~~text
[latex]
e^{i\pi}+1=0
~~~

Changing only color, removing `[latex]`, or displaying another raw-text fallback does not satisfy acceptance.

M9 does not require full LaTeX compatibility, arbitrary document LaTeX, equation numbering, a math editor, or a LaTeX layout engine. The requirement also does not freeze KaTeX, MathJax, SVG, canvas, or the specific Excalidraw primitive strategy; implementation should choose the smallest real approach that fits the existing pipeline.

A second Mermaid reference plugin is not required. Genericity can be proven with registration/runtime tests using an arbitrary test extension type. Mermaid remains deferred until a concrete use case exists.

### Stable identity, geometry, and Camera boundary

Capability lifecycle must not alter:

- `ExtensionNode` semantic ID;
- source range;
- slide position;
- extension content box;
- primary tree;
- SoftLinks;
- PresentationPaths;
- Camera current slide or path occurrence.

Specialized render element IDs should derive deterministically from the existing `ExtensionNode` identity.

Camera remains unaware of content renderer type.

### Canonical fixture and browser-visible acceptance

M9 should evolve `examples/m8-soft-links-presentation-paths.mindppt`, or a semantically equivalent next-generation integrated fixture, instead of using an isolated LaTeX-only demo as the sole acceptance proof.

The canonical presentation adds at least one LaTeX fenced `ExtensionNode` while retaining the already delivered branching tree, ordinary Markdown, M6 layout/image behavior, M7 table/bar page, M8 SoftLink, M8 PresentationPaths, and Camera traversal.

Browser-visible acceptance is:

1. the canonical source compiles and renders normally with no LaTeX plugin;
2. the LaTeX fence is visible through generic fallback;
3. without source edits or parser recompile, load `dsh-mindppt-latex`;
4. the same semantic `ExtensionNode` in the same semantic box becomes specialized formula rendering;
5. capability discovery reports `latex` active;
6. without source edits or parser recompile, unload the plugin;
7. specialized rendering disappears and generic fallback returns;
8. discovery removes `latex`;
9. ordinary content, layout, assets, table/chart, tree, SoftLink, PresentationPaths, last-good behavior, and Camera state remain intact across the lifecycle.

The playground may add only the minimum affordance needed to drive runtime enable/disable of the LaTeX capability. M9 does not introduce a plugin manager, settings system, marketplace, package installer, or dynamic remote loader.

Visible acceptance:

> The same canonical source and same compiled `ExtensionNode` switch from generic fallback to specialized LaTeX rendering and back again solely through Cordis capability load/unload, with discovery tracking the active renderer and no source edit, semantic recompile, geometry change, or Camera reset.

### Post-M9 Manual Acceptance Gate

Status: complete.

The focused real-machine pass covered the integrated M7/M8/M9 user flow:

- M7 table/bar visual proportion and live data edits;
- M8 saved path traversal, repeated occurrence, route switching, real SoftLink follow, and actual Camera feel;
- M9 fallback, live capability load, specialized LaTeX rendering, unload-to-fallback, and stale scene/handler behavior;
- diagnostics, last-good behavior, and cross-milestone regression feel.

The gate exposed only focused post-M9 rendering defects, which were fixed and re-accepted without starting a visual or architecture redesign. M0-M9 is therefore the accepted standalone baseline for M10.

---

## M10 — DSH Workspace MindPPT Authoring + Preview

Status: implementation complete; automated acceptance pending PR CI; real DSH 0.2.0-rc.2 acceptance pending

Purpose: prove MindPPT v0 inside the official DeepSeek Harness 0.2.0-rc.2 product model without creating a second workspace or document system.

M10 uses the DSH native Workspace as the file browser. The selected workspace `.mindppt` file is the persistent source of truth:

~~~text
DSH native Workspace selection
        |
        v
real .mindppt workspace file
        |
        +--> right-side MindPPT authoring + static preview
        |
        +--> Agent inspect / guarded patch
        |
        `--> independent full presentation Preview
~~~

The integration is one package, `plugins/dsh-mindppt`, with Host and Client entries where rc2 requires them. The standalone playground has no DSH dependency.

### Workspace and source ownership

There is no MindPPT file tree, workspace sidebar, document database, or tab manager. A DSH session file address identifies the selected `.mindppt` file. The integration uses rc2 `workspaceFiles.stat/read/readBytes` for Client-side file reads and related local assets, the DSH Connection exact-Fetch seam for the narrow authoring write route, and Host `ctx.fs` for actual file writes.

`mindpptEditor`, parser, canvas, and Camera are runtime projections of that file. They are not a second persistent document store.

Human edits and Agent edits therefore converge on the same path:

~~~text
workspace file write
  -> MindPPT editor/parser runtime
  -> current diagnostics
  -> success: new semantic structure + preview
  -> failure: invalid source remains in file
              diagnostics describe current source
              last-good structure/preview remains
              structureCurrent = false
~~~

Native Document Preview resource observation supplies external-file refresh while the authoring panel is open. No custom watcher framework or workspace registry is introduced.

### Guarded Agent authoring

M10 exposes only three Agent operations:

- inspect the selected MindPPT document;
- apply one guarded replacement/deletion of an existing non-empty source range;
- read concise v0 language guidance.

The patch contract remains:

~~~ts
{ start, end, expected, replacement }
~~~

`start` and `end` must be integers, `0 <= start < end <= source.length`, and `source.slice(start, end)` must exactly equal `expected`. Rejection performs neither a file write nor a compile. `replacement` may be empty; pure insertion remains unsupported.

Inspection returns the safe workspace-relative file identity, current source and diagnostics, `structureCurrent`, semantic IDs and embedded ranges, tree, SoftLinks, PresentationPaths, and the active `mindpptCanvas.extensionRendererTypes`. When current source is invalid, those semantic values are explicitly marked last-good. Raw Excalidraw scene data is not model-facing.

### DSH right-side authoring surface

The `.mindppt` extension registers an rc2 native Document Preview renderer. It owns complete source loading through `workspaceFiles.read`, rather than adding another sidebar.

The right-side surface contains:

- editable current source;
- current diagnostics with source-range navigation;
- a read-only static Excalidraw projection;
- a Preview action.

The authoring preview does not run Camera choreography. Valid edits update it; invalid edits keep the last-good visual projection.

Local image bytes remain outside the parser and are read with `workspaceFiles.readBytes(..., { baseFile })`, preserving document-relative M6 asset semantics.

### Independent full Preview

Preview opens a new DSH browser tab with the selected workspace resource address. That page rereads the same file and runs the existing parser, canvas, Camera, PresentationPath, and SoftLink behavior. The source editor is absent.

The Excalidraw Camera transition adapter used by the playground was moved behind the existing `canvas-excalidraw` package export so the DSH page and standalone playground reuse one choreography implementation rather than creating a second Camera.

### Standalone playground

The playground source panel now supports Hide editor / Show editor. Hidden mode gives the canvas the presentation area while retaining Camera, PresentationPath, and SoftLink controls. The playground remains usable without DSH installed.

### Acceptance state

Automated coverage includes guarded replacement/deletion validation, rejection-without-write/compile, file switching, invalid-source last-good retention and repair, and the standalone collapsed presentation flow. Existing M0-M9 regression suites remain part of the normal CI gate.

M10 must not be marked complete until the post-merge real-machine gate passes against official DSH 0.2.0-rc.2:

1. select the canonical `.mindppt` from native Workspace;
2. verify right-side source + static preview;
3. verify human edit persists to that file and refreshes preview;
4. inspect through Agent and verify semantic/range/currentness/renderer data with no raw Excalidraw;
5. perform valid, invalid, and repair guarded patches and observe the same open panel without reload;
6. open Preview and verify editor absence plus Camera, PresentationPath, and SoftLink behavior;
7. collapse and restore the standalone playground editor.

No M11 capability, SoftLink Back/history, generic RPC framework, document manager, revision/hash protocol, AST mutation, semantic-node mutation, OT, or CRDT is introduced.

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

By M10, stable semantic IDs plus embedded `SourceRange { start, end }` values support guarded precise Agent patches and editor navigation. A standalone SourceMap object is not required by the v0 contract.

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
