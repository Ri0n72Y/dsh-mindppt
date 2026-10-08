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

- `docs/language-v0.md` — MindPPT Language v0 draft.
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


## M10 implementation: DSH Workspace authoring + Preview

M10 implementation is present, with PR CI and the post-merge real-machine DSH acceptance gate still required before the milestone is marked complete. Runtime compatibility is declared as `>=0.2.0-rc.2`; `0.2.0-rc.2` remains the deterministic development baseline, while real acceptance must use whichever compatible DSH version is actually installed on the test machine.

The persistent source of truth is the real `.mindppt` file selected from the native DSH Workspace. MindPPT does not add a file tree, document manager, tabs, database, or second workspace model. The right-side authoring surface is registered as an rc2 Document Preview renderer for `.mindppt`.

The delivered flow is:

~~~text
native Workspace .mindppt
  -> complete source read
  -> MindPPT runtime projection
  -> right-side read-only Code view or interactive Panorama Preview
  -> same workspace file for human writes and Agent guarded patches
  -> independent full Preview page
~~~

The Host exposes only inspect, guarded patch, and concise language guidance. A guarded patch can replace or delete exactly one existing non-empty `[start, end)` span after integer/range/exact-`expected` validation; a rejected patch neither writes nor compiles. Inspection returns current source and diagnostics, `structureCurrent`, semantic IDs and embedded ranges, tree/SoftLinks/PresentationPaths, and active extension renderer types. It never returns raw Excalidraw JSON.

Compile failure intentionally leaves the invalid source in the workspace file while diagnostics describe that source and the runtime retains the last-successful semantic structure and preview. Repairing the file makes the structure current again.

Client file reads, change observation, and document-relative local image bytes reuse DSH rc2 `workspaceFiles`. Actual writes use the narrow DSH Connection route and Host `ctx.fs`; no generic RPC or file-watcher framework is added.

The right-side Code view is read-only; humans edit the same workspace file through an external editor, and the Agent continues to use guarded patches. The in-tab Panorama Preview fits the complete scene and supports pan/zoom without element editing. Preview on side opens a separate DSH page that uses the existing Excalidraw + Camera + PresentationPath + SoftLink presentation behavior. Its Code panel is read-only, collapsible and closed by default, leaving the presentation canvas full-width. Show Code and Navigation are stacked at the upper-right; expanding Navigation exposes vertically arranged Camera, Path, and SoftLink controls. The DSH plugin compiles directly through `mindpptParser` without loading the standalone `code-editor` service. The standalone playground remains DSH-independent and now allows its editor panel to be hidden and restored for a presentation-style canvas.

Real DSH acceptance remains pending and is the final M10/v0 architecture proof.

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

### Real DSH 0.2.0-rc.2 acceptance flow

Run this as one continuous real-machine flow after `pnpm install` and `pnpm dsh:deploy`; it is intentionally not part of CI.

1. Prepare a DSH workspace containing `presentation.mindppt` plus `assets/customer.svg`: copy `examples/m9-content-plugin-latex.mindppt` to `presentation.mindppt` and preserve the existing relative `./assets/customer.svg` relationship. Start `pnpm dsh mindppt`, open that workspace, and select `presentation.mindppt` from the native Workspace sidebar. The right-side panel must show MindPPT, `Current`, read-only Code, and a `Preview` toggle. Switching to Panorama must show the complete scene with pan/zoom. Opening Preview on side must default to a full-width presentation with a collapsed Code panel. The projection must contain hero, agenda, problem, customer, analysis, summary, the customer SVG, the table, the bar chart, and specialized Euler-formula rendering.

2. Edit `# Analysis Flow` to `# Analysis Flow — Human Edit` in an external workspace editor without reloading the DSH page. The real workspace file and read-only Code/Preview projection must change while status remains `Current`; switch away and reopen the file and confirm the edit persists. Then ask the Agent: `Inspect the currently selected MindPPT document. Report the selected file, structureCurrent, structureBasis, active renderer types, and source range for: "The M9 slice reuses the existing presentation pipeline." Do not modify anything.` Confirm the selected `.mindppt`, `structureCurrent=true`, `structureBasis=current`, active LaTeX renderer, semantic source ranges, and no raw Excalidraw JSON.

3. Ask the Agent to guarded-replace `The M9 slice reuses the existing presentation pipeline.` with `The M10 workspace slice reuses the existing presentation pipeline.` The workspace file, read-only Code view, and Panorama Preview must all change without a page reload. Then intentionally reuse the old expected text without refreshing the patch basis; the stale patch must be rejected with file and preview unchanged.

4. Re-inspect, then guarded-replace `values [184, 121, 96]` with the invalid `values [184, 121,`. The workspace file must keep the invalid source, diagnostics must appear, the header must show `Last-good preview`, and the static projection must stay on the last-good structure. Inspect again and confirm `structureCurrent=false`, `structureBasis=last-good`, with diagnostics for the current invalid source. Guarded-repair the text back to `values [184, 121, 96]`; diagnostics must clear and the structure must return to current.

5. Click `Preview`. The independent page/new tab must have no source editor and must show the full Excalidraw presentation with Camera controls. Exercise focus hero, hero → agenda, and parent → hero. Select path `main` and navigate hero → agenda → customer → analysis → customer → summary, confirming the repeated customer occurrence and Previous navigation. Focus customer and follow `Link: summary`; directed SoftLink follow must work, with no Back/history expectation. Select `short`, navigate to problem, and confirm `e^(iπ) + 1 = 0` remains specialized with the `iπ` superscript not vertically wrapped. Return to customer and confirm `customer.svg` is visible in full Preview.

6. Finally run `pnpm dev` for the standalone playground with no DSH dependency. Click `Hide editor` and confirm the presentation canvas expands while Camera remains usable; click `Show editor` and confirm the editor returns without losing runtime/Camera state.

If every stage passes, record `M10 real DSH 0.2.0-rc.2 acceptance = passed`; only then may M10 and the MindPPT v0 architecture be marked complete. On failure, record the exact stage, observed versus expected behavior, current main SHA, DSH version/profile, and whether the workspace file actually changed before changing architecture.
