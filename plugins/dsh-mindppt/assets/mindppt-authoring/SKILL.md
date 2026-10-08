---
name: mindppt-authoring
description: Author and repair MindPPT .mindppt workspace files with DSH file tools.
---

# MindPPT v0 authoring

Use when creating, editing, or repairing a `.mindppt` presentation. MindPPT source is the single source of truth; the Excalidraw panorama is **view-only**.

1. Read the existing workspace `.mindppt` file using DSH's standard file-read tools; use standard DSH **edit/write** on that same file, not canvas editing.
2. Use only implemented v0 syntax in [the grammar reference](references/v0-grammar.md); start from the [runnable example](examples/authoring-demo.mindppt) when useful.
3. Keep IDs stable and references valid. Local images use paths relative to the workspace file, not this Skill installation.
4. Recheck Code diagnostics and Preview after editing. Fix reported line:column errors. An older rendered scene may be a **last-good** stale preview.
5. `mindppt_inspect` is optional read-only diagnosis. Do **not** require numeric-offset `mindppt_patch` or `mindppt_guidance`; ordinary DSH read/edit/write is sufficient.

**Not implemented:** `deck {}`, named table/chart blocks, line or multi-series charts, or a guaranteed Mermaid renderer. `docs/language-v0.md` is aspirational and not an implementation contract. Fenced extensions render only with an active extension renderer (built-in LaTeX is an example).
