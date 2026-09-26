# MindPPT Language v0

Status: draft  
Scope: authoring language contract for the first MindPPT implementation  
Runtime assumption: Cordis plugins, Excalidraw rendering, camera-driven presentation

## 1. Purpose

MindPPT is not a PowerPoint-compatible document format and is not an Excalidraw file format.

The language describes three things in one source file:

1. **Presentation content** — what each slide contains.
2. **Mind-map topology** — how slides relate spatially as a tree plus optional soft links.
3. **Presentation routes** — optional paths through the tree for conventional next/previous playback.

The source file is the single source of truth.

```text
MindPPT source
    |
    v
code-parser
    |
    v
MindPptStructure
    |               |
    v               v
canvas-excalidraw   camera
    |
    v
Excalidraw scene
```

Users and agents edit source code. The rendered Excalidraw canvas is a projection of that source and is not directly editable in normal authoring mode.

## 2. Design constraints

### 2.1 Slide = mind-map node

There is no separate "mind-map node" and "slide object".

A slide identifier is also the identifier used by the tree, links, and presentation paths.

```mindppt
tree LR
  intro --> market
  market --> customer

slide intro {
  title "Overview"
}

slide market {
  title "Market"
}
```

### 2.2 Slide = Excalidraw frame

A `slide` compiles to an Excalidraw frame plus its child elements.

MindPPT does not introduce a new canvas primitive for slides.

### 2.3 High-level components compile to ordinary Excalidraw elements

Components such as tables, charts, diagrams, titles, and bullets are compiler-level constructs.

They do not become custom Excalidraw element types.

Examples:

```text
table   -> rectangles + lines + text
chart   -> chart renderer -> rectangles/lines/text
diagram -> Mermaid converter -> Excalidraw skeleton
slide   -> frame + children
```

### 2.4 The language does not expose native Excalidraw JSON

The parser may eventually emit Excalidraw element skeletons internally, but native Excalidraw JSON is not part of the MindPPT language contract.

Agents must not generate raw Excalidraw elements.

### 2.5 Structure first, animation second

The language describes topology and paths. Camera choreography is normally inferred by the `camera` plugin.

v0 does not require users or agents to hand-author camera keyframes.

## 3. v0 capability surface

MindPPT v0 contains three conceptual layers.

### Presentation structure

- `deck`
- `tree`
- `link`
- `slide`
- `path`

### Layout and content

- `row`
- `column`
- `grid`
- `stack`
- `absolute`
- `title`
- `subtitle`
- `text`
- `bullets`
- `image`
- `table`
- `chart`
- `icon`
- `diagram`

### Drawing escape hatches

- `shape`
- `line`
- `arrow`
- `group`

The supported native chart types for v0 are:

- `bar`
- `line`
- `radar`

These correspond to Excalidraw's existing open-source chart renderer. Pie, scatter, waterfall, funnel, and other chart families are intentionally deferred.

## 4. File shape

A source file begins with the language marker:

```mindppt
mindppt
```

A normal document then contains some combination of:

```mindppt
mindppt

deck {
  ...
}

tree LR
  ...

link ...

slide ...
slide ...

path ...
```

Declaration order should not determine semantic ownership. A slide may be declared before or after the tree line that references it.

The parser should report duplicate IDs and unresolved references.

## 5. Deck

The `deck` block defines presentation-wide defaults.

v0:

```mindppt
deck {
  size 16:9
  theme "default"
}
```

Expected fields:

- `size` — initially `16:9` and `4:3`.
- `theme` — logical theme identifier resolved by the runtime.

The deck block should remain intentionally small in v0. Detailed typography and palette definitions can be introduced later through theme plugins rather than turning every file into a design-system manifest.

## 6. Tree

The tree is the primary topology and must remain a tree.

Example:

```mindppt
tree LR
  intro --> market
  market --> size
  market --> customer
  market --> competitor
  customer --> product
  product --> summary
```

Direction values initially follow Mermaid-style orientation:

- `LR`
- `RL`
- `TB`
- `BT`

The direction is a spatial layout hint, not a presentation sequence.

### 6.1 Tree invariants

The parser should reject or diagnose:

- multiple parents for one tree node;
- cycles in tree edges;
- duplicate tree edges;
- references to undeclared slide IDs after the full document is resolved.

A source file may contain slides that are not attached to the main tree, but the parser should warn because such slides are unreachable through ordinary mind-map navigation.

## 7. Soft links

Soft links express non-tree relationships.

They do not affect parent/child ownership and should not participate in automatic tree layout except where a layout plugin explicitly chooses to use them as weak hints.

Example:

```mindppt
link competitor -.-> summary
link customer -.-> appendix
```

v0 semantics:

- soft links may connect any two valid slide IDs;
- multiple links may point to the same target;
- soft links do not change the main tree;
- the canvas may hide soft-link edges until relevant;
- the camera may use a different transition style for soft-link jumps.

The exact token `-.->` is provisional but intentionally Mermaid-like.

## 8. Slide

Basic form:

```mindppt
slide market {
  title "A growing premium segment"

  text {
    "Demand remains seasonal."
  }
}
```

Each slide has a globally unique ID.

The ID is the shared reference used by:

- tree edges;
- soft links;
- paths;
- camera targets;
- agent editing tools.

### 8.1 Slide properties

v0 should allow:

```mindppt
slide market {
  layout two-column
  ...
}
```

and later explicit metadata may be added without changing the node identity model.

## 9. Text

The simplest text form is:

```mindppt
text {
  "Demand remains seasonal."
}
```

A named element is preferred when the text is likely to be revised independently:

```mindppt
text insight {
  "Premium demand is increasing."
}
```

v0 text styling should apply to the whole text element:

```mindppt
text insight {
  value "Premium demand is increasing."
  size 28
  align left
  color accent
}
```

### 9.1 No inline rich text in v0

Excalidraw text elements do not provide PowerPoint-like mixed formatting inside a single text element.

The following is therefore not a v0 requirement:

```text
Revenue grew by **37%** year over year.
```

Authors should instead use separate text elements when visual emphasis matters:

```mindppt
row {
  text { "Revenue grew by" }

  text growth {
    value "+37%"
    size 48
    color accent
  }

  text { "year over year" }
}
```

This avoids implementing a custom inline rich-text layout engine in the first release.

## 10. Title, subtitle, and bullets

These are semantic convenience components.

```mindppt
title "German Outdoor Market"

subtitle "2026 opportunity review"

bullets {
  "Demand remains seasonal"
  "Premium products gain share"
  "Online channels continue growing"
}
```

They compile to ordinary Excalidraw text elements with theme-defined defaults.

The value of these constructs is not that Excalidraw cannot render text. Their value is that themes, layout rules, QA, and agent authoring policies can recognize their semantic roles.

## 11. Images

Example:

```mindppt
image hero {
  src "./assets/outdoor.jpg"
  fit cover
}
```

v0 image properties should include:

- `src`
- `fit`: `contain` | `cover`
- optional element ID through the declaration name
- sizing and placement inherited from the surrounding layout container or explicit geometry

Remote URL behavior should be a runtime policy rather than a language guarantee.

## 12. Layout

The language should prefer semantic layout over explicit coordinates.

### 12.1 Row

```mindppt
row {
  ...
}
```

### 12.2 Column

```mindppt
column {
  ...
}
```

### 12.3 Grid

```mindppt
grid 2 {
  ...
}
```

The integer is the number of columns in v0.

### 12.4 Stack

```mindppt
stack {
  ...
}
```

A stack places children in the same layout region, useful for overlays and background/foreground composition.

### 12.5 Named layout presets

Slides may select a higher-level preset:

```mindppt
slide market {
  layout two-column

  left {
    ...
  }

  right {
    ...
  }
}
```

Initial useful presets:

- `hero`
- `title-content`
- `two-column`
- `three-column`
- `full-bleed`

Presets are intentionally few in v0.

### 12.6 Absolute escape hatch

Explicit geometry exists for cases semantic layout cannot express.

```mindppt
absolute {
  text note {
    at 62% 75%
    size 28% 10%
    value "Source: internal analysis"
  }
}
```

Percent-based slide-relative geometry is preferred for source readability.

The compiler eventually resolves semantic and explicit layout into concrete coordinates before generating Excalidraw elements.

## 13. Shapes

v0 native shape families should match Excalidraw's stable primitives:

- `rectangle`
- `ellipse`
- `diamond`

Example:

```mindppt
shape callout {
  type rectangle
  label "Key insight"
  fill accent-soft
  stroke accent
}
```

Expected common style properties:

- `fill`
- `stroke`
- `strokeWidth`
- `strokeStyle`
- `opacity`
- `roughness`
- optional label

Unsupported Mermaid-style exotic shapes should not be elevated into MindPPT v0 primitives.

## 14. Lines and arrows

Examples:

```mindppt
line divider {
  stroke muted
}

arrow flow {
  from problem
  to solution
  label "drives"
}
```

Arrows may bind to named elements when both live inside one slide or component.

Tree edges are not authored through this primitive. `arrow` is slide content; `tree` and `link` are presentation topology.

## 15. Groups

Example:

```mindppt
group metric {
  shape {
    type rectangle
  }

  text {
    "+37%"
  }
}
```

A group compiles into grouped Excalidraw elements.

It is primarily useful as:

- a reusable visual unit;
- a target for layout;
- a target for camera/morph experiments later;
- a way to preserve semantic identity through compilation.

## 16. Tables

Excalidraw has no native table element, so MindPPT treats a table as a compiler macro.

Example:

```mindppt
table metrics {
  columns ["Metric", "2025", "2026"]

  row ["Revenue", 12, 18]
  row ["Margin", "22%", "29%"]
}
```

Compilation:

```text
table
  -> cell rectangles / grid lines
  -> text elements
  -> group
```

v0 should support:

- header row;
- row data;
- string and numeric cells;
- theme-level header/body styling;
- automatic equal-width columns by default.

Deferred:

- merged cells;
- nested tables;
- formulas;
- spreadsheet editing;
- arbitrary per-cell rich formatting.

## 17. Charts

MindPPT charts are semantic data objects.

Example:

```mindppt
chart growth {
  type bar

  labels ["2024", "2025", "2026"]

  series "Market" [100, 116, 137]
  series "Premium" [22, 31, 44]
}
```

v0 chart types:

```text
bar
line
radar
```

These align with Excalidraw's existing open-source chart renderer.

The parser should preserve structured chart data rather than flattening a chart immediately into drawing primitives. The renderer plugin may then delegate to Excalidraw's chart renderer.

v0 chart data model:

```text
title?       string
labels?      string[]
series[] {
  title?     string
  values     number[]
}
```

A chart should remain a semantic object in `MindPptStructure` even though it ultimately compiles to ordinary Excalidraw elements.

Deferred:

- pie;
- scatter;
- waterfall;
- funnel;
- combo charts;
- secondary axes;
- PowerPoint embedded workbook compatibility.

## 18. Diagrams

MindPPT should support embedding Mermaid diagrams as a high-level component.

Example:

```mindppt
diagram architecture {
  type mermaid

  """
  flowchart LR
    User --> API
    API --> Database
  """
}
```

The renderer can route Mermaid content through `@excalidraw/mermaid-to-excalidraw`.

Expected behavior:

- diagram content remains source text inside MindPPT;
- conversion output becomes Excalidraw skeleton/elements;
- supported Mermaid diagram families may become editable native shapes;
- unsupported families may degrade to an image according to the converter's behavior.

MindPPT does not need to duplicate Mermaid's diagram grammar.

## 19. Icons and Excalidraw libraries

Icons are logical references resolved by a library provider.

Example:

```mindppt
icon cloud {
  source "aws/ec2"
}
```

The language should not encode raw Excalidraw library JSON.

Possible providers include:

- bundled MindPPT libraries;
- Excalidraw libraries;
- Iconify-like providers;
- domain-specific icon packs.

Exact provider syntax remains provisional for v0.

## 20. Path

A path defines an optional ordered playback route through the graph.

Example:

```mindppt
path main {
  intro
  market
  size
  market
  customer
  product
  summary
}
```

Another path may reuse the same tree:

```mindppt
path short {
  intro
  market
  summary
}
```

A path:

- does not modify tree structure;
- may revisit a node;
- may use tree edges or soft links;
- may contain arbitrary jumps if the camera supports them.

Traditional "next slide" behavior is therefore a path through a spatial structure rather than the primary document model.

## 21. Camera semantics

Camera behavior is not authored in detail in v0.

The `camera` plugin receives:

- node geometry;
- tree parent/child relationships;
- soft links;
- selected presentation path;
- current and target node.

The default transition families are expected to be:

### Parent -> child

```text
focus current
-> zoom out enough to reveal the relationship
-> move along the branch
-> zoom into target
```

### Child -> parent

The inverse of parent -> child.

### Soft-link or arbitrary jump

```text
zoom out
-> traverse quickly with broader spatial context
-> zoom into target
```

The language may gain explicit transition hints later only when automatic choreography proves insufficient.

## 22. Example: complete seven-slide document

```mindppt
mindppt

deck {
  size 16:9
  theme "business"
}

tree LR
  intro --> market
  market --> size
  market --> customer
  market --> competitor
  customer --> product
  product --> summary

link competitor -.-> summary

slide intro {
  layout hero

  title "German Outdoor Market"
  subtitle "2026 opportunity review"

  image hero {
    src "./assets/outdoor.jpg"
    fit cover
  }
}

slide market {
  layout two-column

  left {
    title "A growing premium segment"

    bullets {
      "Demand remains seasonal"
      "Premium products gain share"
      "Online channels continue growing"
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

slide size {
  title "Market expansion is visible across segments"

  chart trend {
    type line
    labels ["Q1", "Q2", "Q3", "Q4"]
    series "Entry" [18, 22, 24, 27]
    series "Premium" [11, 17, 23, 31]
  }
}

slide customer {
  layout two-column

  left {
    image persona {
      src "./assets/customer.png"
      fit contain
    }
  }

  right {
    title "Who is buying?"

    bullets {
      "Younger outdoor users"
      "Comfort-sensitive buyers"
      "Online-first product discovery"
    }
  }
}

slide competitor {
  title "Competitive positioning"

  table comparison {
    columns ["Segment", "Typical position", "Opportunity"]
    row ["Entry", "Price-led", "Low"]
    row ["Mid", "Feature-led", "Medium"]
    row ["Premium", "Comfort-led", "High"]
  }
}

slide product {
  title "Position around comfort and clarity"

  diagram {
    type mermaid

    """
    flowchart LR
      Need[Customer need] --> Product[Product proposition]
      Product --> Proof[Proof points]
    """
  }
}

slide summary {
  layout hero

  title "One message"
  subtitle "Win the premium customer with a clearer comfort proposition."
}

path main {
  intro
  market
  size
  market
  customer
  product
  summary
}

path short {
  intro
  market
  summary
}
```

## 23. Parser output shape

The exact TypeScript contract is implementation work, but the semantic boundary should look roughly like:

```ts
interface MindPptStructure {
  deck: DeckSpec
  slides: SlideNode[]
  tree: TreeEdge[]
  links: SoftLink[]
  paths: PresentationPath[]
  diagnostics: Diagnostic[]
}
```

A slide should preserve high-level components until the canvas renderer compiles them:

```ts
interface SlideNode {
  id: string
  layout?: SlideLayout
  children: ComponentNode[]
}
```

This is deliberate. Flattening everything to Excalidraw primitives in the parser would make table/chart/diagram semantics disappear too early.

## 24. Diagnostics

The parser/compiler should produce diagnostics suitable for both humans and agents.

Examples:

```text
ERROR tree:
node "customer" has multiple parents

ERROR path.main:
unknown slide "pricing"

WARN slide.market:
slide is not reachable from the main tree

WARN slide.customer:
content density may exceed the selected layout

WARN chart.growth:
series lengths do not match labels
```

Diagnostics should carry source ranges so `code-editor` and `dsh-capability` can patch the correct region.

## 25. Agent authoring implications

The language is designed for machine editing as much as human editing.

Important properties:

- stable IDs;
- named elements;
- local declarative blocks;
- semantic layout;
- structured chart/table data;
- source-range diagnostics;
- no requirement to calculate every pixel coordinate;
- no raw Excalidraw JSON.

The DSH capability layer should additionally teach presentation-structure principles that are not parser rules.

Examples:

- prefer a broad, shallow tree over a deep sequence;
- avoid degrading the mind-map into `A -> B -> C -> D -> E` unless the content is genuinely sequential;
- prefer balanced branching where the material supports it;
- reuse a parent node as a spatial hub when moving between sibling arguments;
- use soft links for meaningful cross-references rather than forcing multiple parents;
- create short alternative paths instead of duplicating slide content.

These are authoring policies, not syntax constraints.

## 26. Explicit v0 non-goals

The first language version does **not** attempt to support:

- arbitrary native Excalidraw JSON;
- direct canvas editing as source;
- inline mixed rich-text formatting;
- PowerPoint SmartArt;
- video/audio;
- arbitrary JavaScript;
- arbitrary CSS;
- user-authored camera keyframes;
- PowerPoint animation compatibility;
- every Mermaid diagram as editable native shapes;
- every chart type;
- spreadsheet formulas;
- merged table cells;
- full PPTX import/export fidelity.

These may be added by later plugins without changing the basic source -> structure -> canvas architecture.

## 27. Open questions

These decisions should remain intentionally open until the parser and renderer prototypes exist:

1. Whether the parser should reuse Mermaid internals or only adopt Mermaid-like graph syntax.
2. Whether `left { }` / `right { }` are special syntax or named slots provided by layout presets.
3. Exact geometry syntax for the `absolute` escape hatch.
4. Theme property syntax and whether theme definitions belong in source files at all.
5. Icon provider addressing.
6. How source element IDs map to stable Excalidraw element IDs across recompilation.
7. How much rendered diffing `canvas-excalidraw` should perform versus rebuilding one affected slide.
8. Whether diagrams remain semantic objects after rendering or are treated as generated child groups.
9. Whether chart output should directly reuse Excalidraw's internal chart code or copy/adapt the relevant renderer behind a Cordis service.
10. Whether multiple independent trees are ever needed. v0 assumes one primary tree.

## 28. v0 acceptance test

The language is sufficient for the first milestone when one source file can express and render:

- at least six slides;
- one branching tree;
- one soft link;
- two presentation paths;
- text/title/bullets;
- image;
- table;
- bar or line chart;
- Mermaid flowchart;
- semantic two-column layout;
- one explicit geometry override;
- camera navigation between parent, child, and non-parent target.

That milestone is intentionally about proving the authoring and spatial-presentation model, not reproducing PowerPoint.
