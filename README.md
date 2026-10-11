# dsh-mindppt

MindPPT is a Cordis-native experiment that treats presentation slides as nodes on an infinite mind-map canvas.

The project is intentionally **Cordis-entangled**: major capabilities are implemented as Cordis plugins and services rather than standalone domain libraries. DSH integration is optional, while Cordis is part of the runtime architecture.

## Core idea

```text
MindPPT source code
       |
       v
   code-parser
       |
       v
MindPPT structure
   |          |
   v          v
canvas      camera
   |
   v
Excalidraw
```

A slide is rendered as an Excalidraw frame. Tree edges define the primary spatial structure, soft links add cross-tree relations, and presentation paths define optional playback routes through that structure.

## Plugin split

Current standalone runtime:

- `code-editor` — edits MindPPT source; source code is the single source of truth.
- `code-parser` — parses MindPPT source into semantic structure with stable IDs and embedded source ranges.
- `canvas-excalidraw` — subscribes to compiled structures and lowers them to Excalidraw elements.
- `camera` — controls presentation navigation and viewport transitions.

M10 adds one optional DSH integration package, `dsh-mindppt-plugin` in `plugins/dsh-mindppt`. Its minimum supported DSH runtime is `>=0.2.0-rc.2`; development and automated tests remain pinned to `0.2.0-rc.2` as the deterministic compatibility baseline. The package binds the accepted MindPPT runtime to the native Workspace, Agent tools, right-side Document Preview surface, and independent full Preview page. The Host/Client split follows the DSH product architecture established by that baseline.

The standalone web host runs the existing Cordis plugins without requiring DSH.

Web graphical interfaces are written in React + TypeScript. React owns host UI composition; Excalidraw remains the canvas renderer rather than the application state model.

## Design documents

- `docs/language-v0.md` — future language design, not the runnable parser contract. See the [bundled Skill grammar reference](plugins/dsh-mindppt/assets/mindppt-authoring/references/v0-grammar.md) for implemented v0 syntax.
- `docs/code-parser.md` — compiler boundary, output model, source mapping, and stable identity.
- `docs/roadmap.md` — accepted v0 implementation roadmap and milestone delivery contract.


## Completed vertical slice: M6

M6 now includes the complete initial layout preset set plus the first local image/asset pipeline slice.

Canonical fixtures:

- `examples/m6-layout-presets.mindppt` — `hero`, `title-content`, and `two-column` in one visible tree;
- `examples/m6-two-column.mindppt` — focused two-column + local-image regression fixture.

The delivered path is:

```text
MindPPT source
    |
    v
hero / title-content / two-column
    |
    v
compiler-owned semantic placement
    |
    +--> ordinary Markdown content
    |
    +--> left/right slots for two-column
    |
    v
Markdown image node
    |
    v
Excalidraw image skeleton + stable semantic identity
    |
    v
document-relative local asset resolution
    |
    v
content-revision binary fileId + Excalidraw BinaryFiles
    |
    v
visible browser canvas
```

`hero` vertically centers a compact ordinary-content stack inside a deterministic slide-relative box. `title-content` separates the first level-one title from the ordinary content region. `two-column` keeps the title in the slide header and lays out named `left` / `right` slots. All three presets produce semantic placement in the compiler/layout layer: slide-relative position, available width, and basic block rhythm. Excalidraw owns real font measurement during conversion rather than the compiler approximating glyph metrics. After Excalidraw's fonts settle, the browser host reconverts the same semantic scene once so cold-start rendering and later source recompiles use the same font metrics.

Image source paths remain semantic source data; browser bytes and Excalidraw binary identity are handled outside the parser model. Binary file IDs are deterministic for unchanged source + bytes and change when the bytes at the same source change. Missing, malformed, or non-local assets produce warnings instead of crashing the live authoring loop.

M3-M5 behavior remains part of the same runtime: failed compiles keep the last-good elements and files, stable slide/content identities are preserved, and Camera remains content-agnostic. Successful asset-warning snapshots publish source, elements, files, and camera from the same logical compile. Chromium coverage exercises all three M6 presets, cold-start font readiness, live recompilation, the local image pipeline, last-good behavior, and the canonical M4 camera flow.

M6 is complete at the current product boundary. Broader image-fit behavior beyond the deterministic current image box is deferred to the backlog until a concrete presentation use case requires it. No generic layout engine, theme system, asset registry, or CSS-like layout DSL is introduced by the initial preset set.

## M7 complete: delivered through M7.1

M7 is complete at the current product/v0 boundary. M7.1 is the delivered vertical slice: it adds the first core structured data-analysis page without changing the M6/M5 architecture boundary, and its table + single-series bar chart satisfies the v0 table/chart requirement.

The canonical source is `examples/m7-data-analysis.mindppt`. It keeps the existing hero, title-content, two-column, local-image, and Camera smoke path, then adds one analysis slide whose left slot is a structured table and whose right slot is a single-series bar chart.

The v1 grammar is intentionally narrow:

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

Array payloads use JSON literals. Table cells may be strings or finite numbers; one header is required and every row must match its column count. Bar charts accept one string-label array and one finite-number array with equal lengths.

Both constructs are core `ContentNode` variants, not Markdown/GFM tables and not fenced extensions. The compiler assigns their two-column placement plus deterministic table-cell/bar geometry and semantic IDs. `canvas-excalidraw` only lowers that semantic geometry to fixed Excalidraw rectangles, labels, and a baseline. There is no chart engine, table framework, theme API, registry, new service, multi-series support, or line/radar implementation.

Chromium coverage exercises the canonical table/chart page, visible table edits, visible numeric bar edits, structured diagnostics with last-good retention, automatic repair recovery, and the existing M5/M6 browser regressions.

Run the standalone playground with:

```sh
pnpm install
pnpm dev
```

The canvas remains a projection of source code. Direct canvas editing is not a semantic authoring path.


## M8 complete: soft links + presentation paths

M8 completes the first nonlinear presentation slice on top of the existing primary-tree and Camera architecture. The canonical source is `examples/m8-soft-links-presentation-paths.mindppt`: it keeps a branching primary tree, M6 layout/image behavior, and the M7 structured table + single-series bar chart while adding one visible directed SoftLink and two saved presentation paths.

Soft links compile into resolved directional semantics with deterministic IDs and source ranges. They never participate in primary-tree ownership or world layout. `canvas-excalidraw` lowers them as straight dashed directed arrows using only the already-computed source and target slide boxes.

Presentation paths compile into named ordered occurrences. Repeated slide IDs are valid because Camera tracks the occurrence index as the authoritative route cursor. Path selection, previous, and next reuse the existing Camera focus request and M5 viewport choreography. Direct focus, parent/child navigation, and declared SoftLink follow exit active path playback.

The playground exposes only the controls needed for this slice: a saved-path selector, previous/next buttons, visible occurrence state, and outgoing SoftLink actions derived from compiled semantics. Failed source edits retain the last-good scene and Camera/path state; successful recompiles preserve an active path only when the exact occurrence still resolves to the current slide.

M8 intentionally adds no generic graph model, route engine, path registry, navigation framework, transition family, canvas-edge clicking, or presentation-player subsystem.


## M9 implementation delivered: content renderer lifecycle + LaTeX reference plugin

M9 implementation adds the minimum runtime content-renderer contract to `mindpptCanvas`. Renderer registrations are local to one Canvas service instance, duplicate type claims are rejected deterministically, renderer failure falls back per node, and active renderer discovery reflects the actual registration map. Loading or unloading a renderer reprojects the current last-successful `MindPptStructure`; it does not edit source, invoke parser compilation, change compiler-owned geometry, or reset Camera/path state.

The reference package `dsh-mindppt-latex` is a real Cordis plugin that claims only `latex`. Its registration is wrapped in `ctx.effect()`, so disposing the plugin fiber automatically removes the capability and restores generic fallback. The M9 formula profile renders exponent syntax such as `e^{i\\pi} + 1 = 0` with separate baseline and superscript primitives inside the existing semantic box rather than presenting the raw fence text.

The standalone playground uses `examples/m9-content-plugin-latex.mindppt`, keeps the M6/M7/M8 integrated behaviors, and exposes only two lifecycle controls: Enable LaTeX and Disable LaTeX, plus the active renderer list. Independent review, merge, focused post-M9 fixes, and the integrated real-machine M7/M8/M9 acceptance pass are complete. M0-M9 is the accepted standalone baseline.


## M10 implementation: DSH native Workspace, read-only views, and Agent authoring

**Implementation merged; PR CI green. Complete Windows DSH / Agent end-to-end acceptance remains PENDING.** The plugin supports DSH `>=0.2.0-rc.2`; `0.2.0-rc.2` is the pinned *development/CI* baseline, not a claimed real-machine acceptance version. The reported Windows installation was `0.2.1-alpha.1`; record the actual compatible DSH version when testing.

A real Workspace `.mindppt` is the **single persistent source of truth**. The DSH plugin reuses native file selection, Document Preview and workspace reads; it adds no independent editor, file tree, or document store. DSH compiles with `mindpptParser` directly and does not load the standalone `code-editor` service.

~~~text
DSH native Workspace .mindppt file
  |--> human: external editor -> same file
  |--> Agent: standard DSH read / edit / write -> same file
  |--> Document Preview: read-only Code <-> view-only Panorama
  |      (DSH-native Preview/Code split button; pan/zoom/whole-scene fit)
  `--> dropdown "Preview on side": separate presentation page
         (Camera / PresentationPath / SoftLink navigation;
          read-only Code collapsed by default)
~~~

Right-side Code is **read-only** and opens by default; the split-button primary action switches **Code ↔ Panorama** in the same tab. Its DSH-native anchored/portaled Menu opens the separate **Preview on side** page. Panorama displays the complete Excalidraw projection with pan/zoom, not element editing. The separate page presents the canvas full-width by default, with a collapsible read-only Show Code panel and Camera/Path/SoftLink navigation. Humans edit through their external editor, not either DSH Code view. The standalone playground retains its separate editable Code UI and Hide editor / Show editor controls.

The Host registers the bundled `mindppt-authoring` Skill with DSH's `skills` service. Its [implemented grammar](plugins/dsh-mindppt/assets/mindppt-authoring/references/v0-grammar.md) and [runnable example](plugins/dsh-mindppt/assets/mindppt-authoring/examples/authoring-demo.mindppt) are published assets. Preferred Agent authoring uses **ordinary DSH workspace file read/edit/write on the same `.mindppt`**, then checks diagnostics and Preview. Real installed-profile visibility in `<available_skills>`, `skill({name:'mindppt-authoring'})` loading (with references) from a different workspace, and native Agent file writes **are not yet verified**. An active `dsh-tool-skill` consumer is needed to expose the Skill to the model; config-dump alone is insufficient.

For compatibility, `mindppt_inspect` (selected-file semantic/diagnostic inspection), `mindppt_patch` (guarded replace/delete of an existing non-empty `[start,end)` span with exact expected-text and file-version checks), and `mindppt_guidance` **remain registered**. These are optional APIs, **not** the preferred Agent editing protocol or prerequisites for using the Skill. Guarded-patch/CAS CI tests do not prove a real Agent can use standard DSH read/edit/write. No raw Excalidraw JSON authoring is supported.

If a write makes the source invalid, the workspace file keeps it and diagnostics refer to that source. A previous successfully compiled scene remains visibly labeled **Last-good preview (outdated)**; a first invalid file instead shows **Compile failed — no preview**. Once repaired, the current projection returns. Local image paths are resolved relative to the `.mindppt` workspace file.

**Pending manual gates:** Windows DSH light/dark and split-button focus/menu behavior, two-surface view-only/pan/zoom, persisted external edits, model-visible installed Skill and its relative assets, standard Agent file-edit workflow, Camera/Path/SoftLink navigation and last-good/recovery. Windows sandbox ACL problems are upstream and separate; do not treat them as MindPPT parser defects or change permissions to pass these gates. Comprehensive M10 acceptance has **not** passed.

### Quick DSH deploy

The deployment helper is intentionally pinned to DSH `0.2.0-rc.2`. From the repository root:

```sh
pnpm install
pnpm dsh:deploy
```

The default target is the `mindppt` profile. If the profile does not exist, the helper initializes it through the official rc2 Web template, verifies the Web Workspace/Document Preview surface, installs the current local `plugins/dsh-mindppt` checkout through `dsh plugin`, then performs a boot-free config-dump smoke check that the MindPPT Bundle is active. An existing profile is never rebuilt; if it is not Web-backed, deployment fails instead of rewriting DSH profile storage.

Use another profile with the rc2 selector:

```sh
pnpm dsh:deploy -- --profile review
```

Additional pnpm arguments for the rc2 plugin operation are forwarded in order:

```sh
pnpm dsh:deploy -- --profile review --offline
```

Launch the default profile with the official rc2 profile shorthand:

```sh
pnpm dsh mindppt
```

### Real DSH acceptance flow (installed compatible version; PENDING)

Run the following on a real DSH installation after rebuilding/deploying; record the **actual** version, profile and current main SHA. The deploy helper uses the pinned rc2 development baseline, but that does not establish the version installed for manual acceptance. This gate is **not CI**.

1. Open a DSH Workspace with `presentation.mindppt` copied from `examples/m9-content-plugin-latex.mindppt`, preserving `./assets/customer.svg`. Select the real file in native Workspace. Verify **read-only Code** opens by default; the native split primary button switches Code ↔ whole-scene Panorama with pan/zoom, and its menu opens **Preview on side** in a separate tab. Confirm local images, M7 table/bar, and M9 LaTeX render.

2. Edit `# Analysis Flow` to `# Analysis Flow — Human Edit` in an **external editor**. Without page reload, confirm the same file's Code and Panorama projection refresh; reopen the file and confirm the change persists. Neither DSH Code nor Excalidraw canvas should be editable.

3. From an Agent session with a preset that activates `dsh-tool-skill`, verify `mindppt-authoring` appears in `<available_skills>`. Load it with `skill({name:'mindppt-authoring'})` and open its grammar/example references from the **installed package**, using an unrelated workspace as the Agent current directory. A plugin config-dump or provider unit test cannot substitute for model-visible discovery.

4. Use ordinary DSH workspace **read/edit/write** to change `The M9 slice reuses the existing presentation pipeline.` to `The M10 workspace slice reuses the existing presentation pipeline.` in the same selected file. Confirm the file, Code and Panorama reflect that edit without reload. This is the **primary Agent authoring gate**; do not require `mindppt_patch` offsets.

5. Through normal file editing, deliberately make `values [184, 121, 96]` invalid (for example, `values [184, 121,`). Confirm current-source diagnostics and a visibly labeled **Last-good preview** retain the earlier scene. Repair via normal file editing; verify diagnostics clear and the structure becomes current again. Separately open an invalid file without prior successful compilation and confirm a visible **Compile failed — no preview** message with location rather than an unexplained blank canvas.

6. As a **separate legacy compatibility check**, use `mindppt_inspect` and `mindppt_patch` if available: inspect current structure and source ranges, guard-replace one existing non-empty span, then deliberately repeat with stale `expected` content and confirm rejection without file or scene change. These APIs remain supported but do not establish the standard Agent file-edit gate above.

7. In both in-tab Panorama and full-page Preview, try Excalidraw create/drag/resize/delete/paste/keyboard operations; confirm elements cannot be mutated while pan/zoom still work. Check the native split-button appearance in light and dark themes, visible Tab focus on both segments, narrow-sidebar portal placement, Escape/outside-click close and focus return as appropriate. Confirm independent Preview initially hides read-only Code and its Camera/Path/SoftLink controls work, including repeated path occurrences, previous/next and link follow (no Back/history expectation).

8. Open the standalone playground (`pnpm dev`) separately; Hide editor / Show editor should preserve the standalone runtime and Camera state. This step does not imply DSH has an editable source panel.

Only after **all required manual gates**, including Agent Skill discovery and native read/edit/write, have real evidence may M10 Windows DSH acceptance be recorded as passed. Until then record **PENDING**, together with failed stage, observed versus expected behavior, installed DSH version/profile and whether the workspace file changed. Do not infer M10 completion from merged implementation or green CI alone.
