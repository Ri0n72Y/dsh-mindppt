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

MindPPT DSL constructs are recognized only at structural block-start positions outside fenced blocks.

The compiler therefore treats fenced content as opaque to the structural parser.

Example:

~~~~mindppt
slide math {
  # Formula

  ~~~latex
  f(x) = \{x \mid x > 0\}
  A --> B
  ~~~
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
~~~latex
e^{i\pi} + 1 = 0
~~~
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

Initial references include:

- tree edges to slide IDs;
- soft links to slide IDs;
- path entries to slide IDs.

Later references may include named structured components where a real feature requires them.

Declaration order must not decide validity.

## 8. Semantic validation

Validation grows with the roadmap.

Graph validation includes:

- duplicate slide IDs;
- unresolved slide references;
- duplicate tree edges;
- multiple parents;
- cycles;
- unreachable slides as warnings.

Structured content validation later includes:

- invalid layout-slot usage;
- table shape errors;
- chart labels/series mismatch;
- asset-resolution warnings;
- extension capability conflicts or missing-renderer warnings.

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
  sourceMap: SourceMap
}
~~~

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

Soft links do not alter parent ownership or primary placement.

## 13. Stable semantic identity

Recompilation must not make every semantic object appear new.

Named declarations naturally provide stable keys:

~~~text
slide:market
slide:market/chart:growth
~~~

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

## 14. Source map

Source ranges are first-class compiler output from the first real parser milestone.

M1 starts with structural ranges.

M2-M3 expand ranges to Markdown content and diagnostics.

Conceptually:

~~~text
slide:market
  -> lines 20-42

slide:market/title:0
  -> line 23

slide:market/chart:growth
  -> lines 31-37
~~~

Source maps later enable:

- editor navigation;
- diagnostics;
- precise DSH agent patches;
- refactoring tools.

The M0 bootstrap parser intentionally omits source maps.

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

## 16. Cordis service boundary

The public service stays small.

Conceptually:

~~~ts
ctx.mindpptParser.compile(source)
ctx.mindpptParser.structure
ctx.mindpptParser.diagnostics
ctx.mindpptParser.sourceMap
~~~

Expected events may include:

~~~text
mindppt/compiled
mindppt/diagnostics
~~~

Exact public names can evolve with implementation.

No supported standalone parser API outside Cordis is required.

## 17. Extension capability boundary

code-parser always emits generic ExtensionNode values.

A content plugin such as dsh-mindppt-latex may later register runtime capabilities for an extension type, but it must not alter outer grammar.

Possible extension runtime capabilities include:

- semantic transformation;
- renderer;
- sizing hint.

If no plugin handles the type, generic fallback remains valid.

If multiple plugins claim one type, runtime capability resolution should report a conflict rather than silently choose a winner.

## 18. What code-parser does not own

code-parser does not own:

- source-editor UI;
- React composition;
- Excalidraw element creation;
- direct canvas mutation;
- viewport animation;
- camera timing;
- DSH prompts and authoring policy;
- sidebar mounting;
- final PPTX export;
- extension-specific grammars.

It enforces structure, content-profile parsing, semantic validity, identity, source mapping, and geometry.

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
