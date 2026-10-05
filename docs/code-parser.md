# code-parser

Status: draft compiler contract aligned with docs/roadmap.md  
Role: core MindPPT compiler plugin  
Runtime: Cordis

## 1. Responsibility

code-parser is the central compiler frontend of MindPPT.

It accepts MindPPT source and produces a resolved, validated, spatially laid-out MindPptStructure for downstream rendering and camera control.

~~~text
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
~~~

The plugin owns the full source-to-structure boundary.

Downstream plugins should not need to understand MindPPT syntax, Markdown content syntax, reference resolution, presentation semantics, or layout rules.

## 2. Compiler phases

The initial implementation keeps compiler phases inside one Cordis plugin.

~~~text
source
  |
  v
structural tokenize / parse
  |
  v
hybrid content parse
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
~~~

These are implementation phases, not separate plugins or packages.

The Ponytail principle applies: do not split them before a real lifecycle boundary exists.

## 3. Structural parser

The outer structural grammar is intentionally small.

Core structure includes:

~~~text
mindppt
deck
slide
tree
link
path
layout blocks
~~~

Graph notation intentionally borrows from Mermaid:

~~~mindppt
tree LR {
  intro --> market
  market --> customer
}

link customer -.-> summary
~~~

The outer language does not implement full Mermaid.

## 4. Hybrid content parser

Inside a slide or layout slot, Markdown is the default content interpretation.

Known MindPPT structural, layout, and core structured-content constructs are recognized only at block-start positions outside fenced blocks. Other slide-body text defaults to the Markdown profile.

The compiler therefore treats canonical triple-backtick fenced content as opaque to the structural parser.

Example:

~~~~mindppt
slide math {
  # Formula

  ```latex
  f(x) = \{x \mid x > 0\}
  A --> B
  ```
}
~~~~

The braces and arrow inside the fence are extension payload, not MindPPT structure.

## 5. MindPPT Markdown Profile

The first intentional content profile grows incrementally.

M1 requires only:

~~~text
# heading
~~~

M2 expands to:

~~~text
# heading
## heading
paragraph
- unordered list
1. ordered list
fenced extension
~~~

Later milestones add images.

Full CommonMark parsing is not required.

The parser should implement only the profile defined by docs/language-v0.md and the current roadmap milestone.

## 6. Extension nodes

The parser does not register extension-specific grammars.

A fenced block becomes a generic semantic node conceptually like:

~~~ts
interface ExtensionNode {
  kind: 'extension'
  type: string
  raw: string
}
~~~

For example:

~~~~markdown
```latex
e^{i\pi} + 1 = 0
```
~~~~

becomes an ExtensionNode whose type is latex and whose raw payload is preserved.

Whether a runtime plugin can render that node is not a syntax question.

This preserves the architecture invariant:

~~~text
Capability != Grammar
~~~

Missing an extension plugin must not cause a parser error.

## 7. Reference resolution

References are resolved after the complete structural document has been parsed.

Core structural references include:

- primary-tree edge endpoints -> slide IDs;
- SoftLink source and target -> slide IDs;
- each PresentationPath occurrence -> a slide ID.

Declaration order must not decide validity.

M8 keeps these as direct core references. Reference resolution resolves SoftLink endpoints; whether the two resolved endpoints are the same slide is a semantic-validation concern. This does not create a generic graph model, route registry, or navigation engine.

Later references may include named structured components only when a concrete feature requires them.

## 8. Semantic validation

Validation grows with the roadmap while keeping primary-tree, soft-link, and path semantics separate.

Primary-tree validation includes:

- duplicate slide IDs;
- unresolved tree-edge slide references;
- duplicate tree edges;
- multiple parents;
- cycles;
- unreachable slides as warnings.

M8 SoftLink validation adds:

- unknown source slide;
- unknown target slide;
- self-link relation where source == target;
- duplicate identical source -> target relation.

Soft links therefore connect distinct slides. The reverse target -> source relation is independent and valid when declared separately between distinct endpoints. No self-loop routing or renderer behavior is required.

M8 PresentationPath validation adds:

- duplicate path ID;
- empty path;
- unknown slide occurrence.

Repeated slide occurrences are valid. Paths are ordered playback data, so the compiler performs no path adjacency validation, path cycle validation, route optimization, or graph-derived route generation.

Structured content validation includes:

- invalid layout-slot usage;
- table shape errors;
- chart labels/series mismatch;
- asset-resolution warnings.

Missing extension renderers do not make source or semantics invalid; generic fallback remains valid. Duplicate renderer claims and specialized-renderer failures belong to the runtime rendering-capability boundary, not parser grammar or semantic validation.

Validation distinguishes:

~~~text
error   -> do not publish unreliable new structure
warning -> publish structure with diagnostics
~~~

Once live editing exists, errors keep the last-good structure visible.

## 9. Output boundary

The output remains semantic enough for presentation-aware downstream behavior, while geometry is resolved enough that the renderer does not perform presentation layout.

Conceptually:

~~~ts
interface MindPptStructure {
  deck: DeckSpec
  slides: SlideNode[]
  tree: TreeEdge[]
  links: SoftLink[]
  paths: PresentationPath[]
  diagnostics: Diagnostic[]
}

interface SoftLink {
  id: string
  fromSlideId: string
  toSlideId: string
  sourceRange: SourceRange
}

interface PresentationPath {
  id: string
  name: string
  occurrences: PresentationPathOccurrence[]
  sourceRange: SourceRange
}

interface PresentationPathOccurrence {
  id: string
  slideId: string
  sourceRange: SourceRange
}
~~~

Source mapping in v0 is carried by stable semantic IDs and embedded `SourceRange` values on the relevant semantic nodes/declarations. `MindPptStructure` does not expose a required standalone `SourceMap` object.

Soft links and paths remain resolved core semantics after parsing. Soft links may be lowered by the renderer as visually distinct relations. Paths remain ordered Camera playback data and are not canvas topology edges.

Downstream renderer and Camera code consume these semantics; they do not parse link/path authoring source.

A slide contains world-space geometry and slide-local semantic nodes:

~~~ts
interface SlideNode {
  id: string

  x: number
  y: number
  width: number
  height: number

  elements: RenderNode[]
}
~~~

Typical v0 RenderNode families:

~~~text
title
subtitle
text
list
image
table
chart
extension
~~~

Tables, charts, and extensions remain semantic until renderer lowering.

## 10. Coordinate model

The compiler uses two coordinate spaces.

### 10.1 World space

Each slide owns:

~~~text
slide.x
slide.y
slide.width
slide.height
~~~

These locate the slide on the infinite mind-map canvas.

### 10.2 Slide-local space

Each content node owns:

~~~text
element.x
element.y
element.width
element.height
~~~

The renderer derives canvas coordinates mechanically:

~~~text
worldElementX = slide.x + element.x
worldElementY = slide.y + element.y
~~~

This separation keeps slide layout independent from mind-map placement.

## 11. Slide layout

code-parser owns semantic layout resolution.

Example:

~~~mindppt
slide market {
  layout two-column

  left {
    # Market

    - A
    - B
  }

  right {
    chart growth {
      type bar
      labels ["2024", "2025"]
      series "Market" [100, 116]
    }
  }
}
~~~

The compiler resolves the content into slide-local boxes.

canvas-excalidraw should not need to understand left/right, hero, title-content, or other presentation-layout semantics.

Layout must remain content-agnostic.

An extension node participates in layout as a box just like text, image, table, or chart.

## 12. Mind-map layout

The compiler resolves the primary tree into deterministic world positions.

~~~mindppt
tree LR {
  intro --> market
  market --> size
  market --> customer
  market --> competitor
}
~~~

Conceptual result:

~~~text
intro       (0, 0)
market      (2200, 0)
size        (4400, -1200)
customer    (4400, 0)
competitor  (4400, 1200)
~~~

Primary layout uses the primary tree only.

Supported direction projections are:

- `LR`: children advance right;
- `RL`: children advance left;
- `TB` / `TD`: children advance downward;
- `BT`: children advance upward.

Sibling/subtree ordering is deterministic, and identical source produces identical semantic IDs and coordinates.

Soft links do not alter parent ownership or primary placement. Presentation paths do not participate in mind-map placement at all.

## 13. Stable semantic identity

Recompilation must not make every semantic object appear new.

Named declarations and core relations provide stable keys:

~~~text
slide:market
slide:market/chart:growth
link:competitor->summary
path:main
path:main/occurrence:3
~~~

A SoftLink identity is directional, so reversing its endpoints produces a different semantic identity. A path occurrence identity is tied to its deterministic occurrence position rather than inferred from slide ID; repeated slide IDs therefore remain distinct semantic occurrences.

Unnamed Markdown content derives deterministic keys from stable structural position:

~~~text
slide:market/title:0
slide:market/list:0
~~~

The parser does not need to manufacture final Excalidraw element IDs.

It must provide stable semantic identity so the renderer can map those IDs deterministically.

This supports:

- deterministic tests;
- selection continuity;
- camera continuity;
- future diffing;
- precise source mapping.

## 14. Source ranges and precise-edit mapping

Source ranges are first-class compiler output from the first real parser milestone.

M1 starts with structural ranges.

M2-M3 expand ranges to Markdown content and diagnostics.

The current implementation contract is embedded semantic ranges, not a standalone `SourceMap` service or object.

Conceptually:

~~~text
stable semantic ID
  +
SourceRange { start, end }
  -> [start, end) JavaScript string offsets
     into the source that produced this structure
~~~

These ranges support:

- editor navigation;
- diagnostics;
- guarded precise DSH Agent patches;
- future refactoring tools when a concrete requirement exists.

M10 must reuse these existing ranges. It should add finer ranges only if a concrete acceptance edit cannot be expressed safely with the current semantic ranges and current source.

The parser owns production of semantic identity, ranges, diagnostics, and compiled structure. It does not own applying Agent patches.

## 15. Diagnostics and last-good output

Once live editing begins, the parser service tracks:

~~~text
current source
latest diagnostics
last successful MindPptStructure
~~~

Expected behavior:

~~~text
source change
    |
    v
compile
  /   \
success error
 |      |
 v      v
publish  diagnostics
new      keep last-good structure
structure
~~~

A half-written block must not blank the presentation.

For M10 inspection, current source/diagnostics must be distinguished from semantic structure currency. When the current source is invalid, the available semantic structure is last-good and callers need an explicit state equivalent to `structureCurrent: false`.

The parser does not auto-rollback an accepted source edit merely because compilation fails.

## 16. Cordis service boundary

The public parser service stays small.

Conceptually:

~~~ts
ctx.mindpptParser.compile(source)
ctx.mindpptParser.structure
ctx.mindpptParser.diagnostics
~~~

Source ranges are carried by the semantic output itself; no separate `ctx.mindpptParser.sourceMap` API is required by the current v0 implementation.

Expected events may include:

~~~text
mindppt/compiled
mindppt/diagnostics
~~~

Exact public names can evolve with implementation.

No supported standalone parser API outside Cordis is required.

Guarded patch application belongs to the DSH workspace authoring boundary. M10 writes the selected real workspace `.mindppt` file, then updates the existing editor/parser runtime projection through the same compile path used by human authoring; code-parser does not become a file store or Agent mutation service. On compile failure the file keeps the invalid current source while `code-parser` continues to expose current diagnostics plus its last-successful `MindPptStructure`.

## 17. Extension capability boundary

code-parser always emits generic `ExtensionNode` values. Renderer capability availability must not change parser grammar or compiler semantic output.

For an unchanged source, loading or unloading an extension renderer must leave the same:

- `ExtensionNode.kind`;
- extension `type`;
- raw payload;
- source range;
- semantic identity;
- compiler-owned `x / y / width / height`;
- containing slide geometry;
- tree, SoftLink, and PresentationPath semantics.

The parser does not register extension renderers and does not inspect the active renderer set while compiling.

M9 v0 establishes one runtime extension capability only:

~~~text
extension renderer capability
~~~

Semantic transformation, sizing hints, and layout hints are not part of the M9 compiler contract. They remain deferred until a concrete extension proves that the existing semantic box is insufficient.

Renderer registration belongs to the runtime canvas/rendering responsibility, scoped to the Cordis runtime and registering fiber. It must not be module-global.

M9 implements this boundary in `mindpptCanvas`: registration state is instance-local, renderer cleanup is attached to the registering plugin through Cordis lifecycle effects, and capability changes re-render the stored last-successful structure without invoking `compile(source)`.

Capability lifecycle is therefore separate from parser lifecycle:

~~~text
source change
  -> parser compile
  -> possibly new last-successful MindPptStructure

renderer capability load/unload
  -> no parser compile
  -> reuse current last-successful MindPptStructure
  -> rebuild rendering projection only
~~~

A renderer capability change must not:

- create a parser compile revision;
- change parser diagnostics;
- mutate source;
- update the last-good semantic structure;
- request new compiler geometry;
- alter Camera semantic state.

If no renderer handles an extension type, the generic fallback remains valid.

If a matching renderer fails for one payload, rendering should fall back to the generic extension representation without invalidating the compiler output.

At most one active renderer may claim an extension type. A duplicate claim is a runtime capability conflict: the rejected registration must not replace, remove, or poison the renderer that is already active.

Capability discovery, when exposed by the runtime, reflects actual active renderer registrations. It is not parser-known extension metadata, source fence discovery, or installed-package discovery.

`dsh-mindppt-latex` is the M9 reference renderer plugin. It consumes the existing `ExtensionNode.raw` and compiler-owned semantic box; it does not add LaTeX grammar or change code-parser output.

## 18. What code-parser does not own

code-parser does not own:

- source-editor UI;
- React composition;
- Excalidraw element creation;
- direct canvas mutation;
- viewport animation;
- camera timing;
- active path selection or occurrence cursor state;
- cursor reconciliation or route migration;
- DSH prompts and authoring policy;
- guarded source-patch application;
- DSH Workspace file selection/read/write ownership;
- Host/Client authoring-route ownership;
- right-side Document Preview mounting;
- final PPTX export;
- extension-specific grammars.

It enforces structure, content-profile parsing, semantic validity, stable identity, embedded source ranges, diagnostics, and geometry.

## 19. Current implementation boundary

### M0

M0 is already merged.

It proves:

~~~text
source
-> Cordis parser service
-> MindPptStructure
-> Cordis renderer service
-> Excalidraw Skeleton
-> React web host
~~~

Its temporary source form is:

~~~mindppt
slide hello {
  title "Hello World"
}
~~~

That syntax is a bootstrap fixture and is not the final content contract.

### M1

The next parser milestone is intentionally small:

~~~mindppt
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
~~~

M1 implements:

- tokenizer;
- structural recursive-descent parser;
- mindppt, slide, tree, and primary edge syntax;
- minimum Markdown heading support;
- source ranges;
- stable IDs;
- reference resolution;
- deterministic two-slide layout;
- renderer delivery of two slides and one tree edge.

M1 does not attempt to compile the complete market-overview example.

### M2

M2 expands content into the first intentional MindPPT Markdown Profile and generic ExtensionNode fallback.

The complete implementation order is defined by docs/roadmap.md.

## 20. Delivery rule

Every parser capability must continue through the existing delivery path.

~~~text
fixture
-> parser / structure test
-> renderer test
-> React playground
-> visible Excalidraw result
-> CI
~~~

Avoid adding parser-only abstractions or syntax that have no current delivery consumer.
