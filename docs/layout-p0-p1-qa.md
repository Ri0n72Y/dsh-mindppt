# Layout P0/P1 semantic overflow QA corpus

Source: [`examples/layout-p0-p1-qa.mindppt`](../examples/layout-p0-p1-qa.mindppt).
One reusable eight-slide document; existing M6/M7/M9 examples remain unchanged.

| Slide | Focus | P1 semantic content-box warning |
| --- | --- | --- |
| `hero-fit` | Hero heading, subtitle, paragraph | No |
| `hero-overflow` | Hero vertical stack longer than slide | Yes: final list |
| `title-overflow` | Title-content body overrun | Yes: final list |
| `slot-overflow` | Two-column left slot overrun; right still fits | Yes: left list |
| `cjk-long` | Long CJK text may wrap visually | No; requires font/render inspection |
| `image-ratios` | Portrait and landscape sources | No; aspect-ratio fit is deferred P3 |
| `dense-data` | Dense table and long chart labels | No; legibility is deferred P3 |
| `extensions` | LaTeX plus unknown fenced fallback | No; glyph/layout fidelity separate |

## Detection boundary

P1 checks only the compiler's **slide-local** `ContentNode` rectangles after
existing layout: `x >= 0`, `y >= 0`, `x + width <= 1280`,
`y + height <= 720` (tiny numerical tolerance). Excalidraw frames, slide
world coordinates, actual glyph bounds, image painting/letterboxing, chart labels
and table-cell glyphs are **not** the subject of this warning. A lack of P1
warnings does **not** certify that the visual slide fits. Warning locations point
to the original source span of the offending content block. Compiling still
succeeds, and IDs, geometry, Camera/Path/SoftLink and PDF permission do not
change merely because of a P1 warning.

Expected P1 results: exactly three `warning` diagnostics: `hero-overflow`
list, `title-overflow` list, and `slot-overflow` left list. The
Playground/DSH existing diagnostic views consume these through the parser
diagnostics channel; no new visual overlay is included.

Browser typography / image shape / chart readability: **UNVERIFIED**.
Actual PDF visual fidelity: **UNVERIFIED** (skipped by user).
Full Windows DSH/Agent E2E: **PENDING**. No screenshots or manual visual
acceptance are claimed by this fixture.
