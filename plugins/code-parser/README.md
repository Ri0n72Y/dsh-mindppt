# dsh-mindppt-code-parser

Cordis-native compiler service for MindPPT source code.

The package intentionally exposes compilation through the Cordis service graph rather than a parallel standalone runtime.

## Current M2 capability

The compiler preserves the M1 structural slice:

```text
mindppt
slide <id> { ... }
tree LR { ... }
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
