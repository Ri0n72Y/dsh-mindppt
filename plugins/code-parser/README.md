# dsh-mindppt-code-parser

Cordis-native compiler service for MindPPT source code.

The package intentionally exposes compilation through the Cordis service graph rather than a parallel standalone runtime.

## Current M4 capability

The compiler preserves the M1 structural slice:

```text
mindppt
slide <id> { ... }
tree <LR|RL|TB|TD|BT> { ... }
A --> B
```

and supports the first MindPPT Markdown Profile inside slides:

```text
# heading        -> title
## heading       -> subtitle
paragraph        -> text
- item           -> unordered list
1. item          -> ordered list
fenced block     -> extension
```

Fenced payload remains opaque to the outer structural grammar. It is emitted as a generic extension semantic node with its type and raw payload preserved. Missing extension capabilities do not make compilation fail.

The compiler produces deterministic slide geometry, stable semantic IDs, and source ranges for content and structure.

M4 supports branching primary trees in `LR`, `RL`, `TB`, `TD`, and `BT` directions (`TD` is an alias of `TB`). Primary-tree validation reports duplicate slide IDs, unknown references, duplicate edges, multiple parents, and cycles as compile errors. Slides outside the primary root remain compilable and produce warning diagnostics.

In M3 the Cordis service also tracks:

```text
source       -> latest attempted source
diagnostics  -> latest compile diagnostics
structure    -> last successful structure
```

A failed live compile updates `source` and `diagnostics` but intentionally leaves `structure` unchanged.

## Cordis service

Mount the plugin class into a Cordis context:

```ts
import { Context } from '@deepseek-ai/cordis'
import MindPptParserService from 'dsh-mindppt-code-parser'

const ctx = new Context()
await ctx.plugin(MindPptParserService)

// Other plugins consume ctx.mindpptParser.
```

The service key is `mindpptParser`.

The implementation order and compiler boundaries are defined in `docs/roadmap.md` and `docs/code-parser.md`.
