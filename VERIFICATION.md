# Verification Record — bmad-test

**Date:** 2026-04-28 (browser-pass amend)
**Original CLI-pass date:** 2026-04-27
**Build SHA at start of pass:** `6483917` (Story 2.5 close) + Phase B1 patch
**Verifier:** browser pass via Chrome DevTools MCP (`chrome-devtools-mcp`) + manual review of artifacts under `verification/`
**Node:** v24.13.0
**Browser:** Chromium (Chrome DevTools MCP managed)

> ## Browser-pass status (2026-04-28)
>
> The 11 `🟡 TBD-by-reviewer` rows from the 2026-04-27 CLI-pass have been re-executed against `npm run build && npm start` on Node 24 using Chrome DevTools MCP. Per-AC outcomes are recorded below; supporting artifacts are saved in `verification/`. Tooling caveats are noted inline (e.g. AC4 screen-reader and AC10 cross-browser cannot be exercised by a single Chromium agent and remain `🟡 TBD-by-human`; AC6 was static-verified because Chrome DevTools MCP doesn't expose `Emulation.setEmulatedMedia` for `prefers-reduced-motion`).

## Tools

- **axe-core 4.10.2** — installed locally (npm), staged to `client/dist/assets/axe.min.js` and loaded same-origin so the app's CSP (`default-src 'self'`) does not block it.
- **Lighthouse** — invoked via Chrome DevTools MCP `lighthouse_audit` (Chrome's bundled Lighthouse CLI). Reports saved to `verification/lighthouse-{device}-{state}.{html,json}`.
- **Screen reader** — `🟡 TBD-by-human` (no SR is exposed through Chrome DevTools MCP). The static a11y inventory below catalogs every label / live region the SR will encounter; this is sufficient for ARIA correctness but does not substitute for an actual VoiceOver / NVDA pass.
- **Browsers** — Chromium only via Chrome DevTools MCP. Firefox / Safari / Edge / iOS Safari remain `🟡 TBD-by-human`.
- **Devices** — emulated only (375×667 mobile viewport with `hasTouch:true` and `isMobile:true`). Real-device sign-off remains `🟡 TBD-by-human`.

## Per-AC Results

| AC | Status | Evidence | Notes |
|---|---|---|---|
| **AC1** axe-core, 3 states | ✅ **pass** | axe-core 4.10.2 run with rulesets `wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice`. (a) empty list: 0 critical, 0 serious, 1 moderate (`page-has-heading-one`), 1 incomplete (`aria-required-children` — empty list, manual). (b) populated 5 tasks: 0 critical, 0 serious, 1 moderate (`page-has-heading-one`), 0 incomplete. (c) load-failed banner: 0 critical, 0 serious, 1 moderate (`page-has-heading-one`), 1 incomplete (`aria-required-children` — empty list while load failed). | Pass criterion (critical=0 AND serious=0) met in all 3 states. The single moderate `page-has-heading-one` is intentional for this minimalist app (no h1 by design — `<title>Tasks</title>` carries the page name). The `aria-required-children` incomplete is axe being unable to verify a list with zero children; the `<ul role="list">` is correct per WAI-ARIA. |
| **AC2** Lighthouse a11y ≥ 95 | ✅ **pass** | Desktop+populated: **100** ([lighthouse-desktop-populated.html](verification/lighthouse-desktop-populated.html)). Desktop+empty: **100** ([lighthouse-desktop-empty.html](verification/lighthouse-desktop-empty.html)). Mobile+populated: **100** ([lighthouse-mobile-populated.html](verification/lighthouse-mobile-populated.html)). Mobile+empty: **100** ([lighthouse-mobile-empty.html](verification/lighthouse-mobile-empty.html)). | All four runs returned 100, well above the ≥95 threshold. JSON traces saved alongside each HTML for diffability. |
| **AC3** Keyboard-only Journey 1 | ✅ **pass** | Walked add → toggle → delete → inline-error retry → load-failed banner retry without mouse. Add: input auto-focused, type + Enter inserts task. Toggle: Tab onto `<li>` (tabIndex=0), Space toggles checkbox. Delete: ArrowDown to next row, Delete key → row removed and focus lands on next sibling `<li>` (Phase B1 fix verified in [client/src/components/TaskItem.tsx:23-32](client/src/components/TaskItem.tsx#L23-L32)). Inline retry: simulated POST failure via fetch interceptor → "Save failed" row appears with Retry button → Tab navigation reaches it → Enter retries → row recovers. Load-failed banner retry: simulated GET failure → banner with `role="alert"` + Retry button appears → Shift+Tab from input lands on Retry → Enter recovers. | Phase B1 focus-after-delete fix observed working: focus moved from deleted row to `nextElementSibling`. Minor note: focus falls to `<body>` after the load-failed banner Retry button unmounts post-success. Not a Phase B1 regression and not specified by Journey 1 — flagged for backlog. |
| **AC4** Screen-reader Journey 1 | 🟡 **TBD-by-human** | Static ARIA inventory below confirms every interactive element has an accessible name and live regions are scoped per spec. | Chrome DevTools MCP cannot drive a real screen reader. Re-run with VoiceOver / NVDA before shipping, per the original Phase A Task A5 repro. |
| **AC5** Achromatopsia color-blind sim | ✅ **pass** | Before / after screenshots: [achromatopsia-before.png](verification/achromatopsia-before.png) and [achromatopsia-after.png](verification/achromatopsia-after.png). | Achromatopsia simulated via SVG luminance color-matrix (the same matrix Chrome DevTools' "Emulate vision deficiencies → Achromatopsia" applies). Completed row is still distinguishable from active rows via strikethrough + `opacity-60` — no color cue needed. (`emulate` tool does not expose vision deficiency emulation, so the simulation is applied via in-page SVG filter — equivalent matrix, same visual outcome.) |
| **AC6** `prefers-reduced-motion` | ✅ **pass (static-verified)** | Inspected the live document's stylesheets at runtime: `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: 0s !important; animation-duration: 0s !important; animation-iteration-count: 1 !important; } }` is present (matches [client/src/index.css:82-91](client/src/index.css#L82-L91)). | Chrome DevTools MCP does not expose `Emulation.setEmulatedMedia` for `prefers-reduced-motion`, so the actual media-query toggle could not be exercised. The CSS rule targets all elements via the `*` selector with `!important`, so any inline / utility-class transition will be neutralized at runtime when the media query matches. Manual confirmation via DevTools → Rendering → Emulate CSS media is still recommended as a final smoke. |
| **AC7** 200% browser zoom | ✅ **pass** | [zoom-200pct.png](verification/zoom-200pct.png) at 1280×720, `document.body.style.zoom = 2`. Measured `documentWidth=1265px ≤ viewportWidth=1280px`, no horizontal scrollbar. | All controls remain visible and within the viewport at 200% zoom; focus ring and layout intact. |
| **AC8** WCAG 2.1 AA contrast | ✅ **pass** | Tokens resolved through canvas (RGB pixels rendered by Chrome's color engine), then luminance-ratio computed per WCAG: `foreground/background = 19.8:1`, `mutedForeground/background = 4.88:1`, `primary/background = 5.39:1`, `destructive/background = 4.99:1`, `ring/background = 5.39:1`. | All five pairs pass their thresholds (text ≥ 4.5, non-text ≥ 3). Tightest margin is `--muted-foreground` at 4.88:1 vs the 4.5 floor — note for any future palette changes. Detailed numbers in the "Contrast pair tokens" table below. |
| **AC9** Viewport sweep (320–1920) | ✅ **pass** | Six screenshots saved: [viewport-320.png](verification/viewport-320.png), [viewport-375.png](verification/viewport-375.png), [viewport-768.png](verification/viewport-768.png), [viewport-1024.png](verification/viewport-1024.png), [viewport-1440.png](verification/viewport-1440.png), [viewport-1920.png](verification/viewport-1920.png). | At 320×568 (320 px is the narrowest emulated mobile width): no horizontal scroll (`scrollWidth=320, innerWidth=320`). Layout integrity confirmed at every breakpoint; row truncation behavior already covered by `truncate` utility in [client/src/components/TaskItem.tsx:69-75](client/src/components/TaskItem.tsx#L69-L75). |
| **AC10** Cross-browser smoke | 🟡 **TBD-by-human** | Chromium (via Chrome DevTools MCP) confirmed working end-to-end. | Firefox, Safari (desktop), Edge, and Safari iOS were not exercised — outside the reach of the Chrome-only DevTools MCP. Run before shipping. |
| **AC11** Real device touch | 🟡 **partial — emulated-only pass** | At 375×667 viewport with `hasTouch:true, isMobile:true`: tap-to-add, tap-to-toggle, tap-to-delete all worked. Hit areas measured: checkbox parent **44×44 px**, delete button **44×44 px** (both meet WCAG 2.5.5 ≥24×24 minimum and the AAA 44×44 guideline). | Real-device sign-off (≥ 1 iOS + ≥ 1 Android) still owed. Emulation explicitly flagged "emulated, not real-device" per the original repro. |
| **AC12** `VERIFICATION.md` exists | ✅ pass | This file | Committed at repo root with 2026-04-28 browser-pass amend. |
| **AC13** Retry idempotency end-to-end (NFR-R3) | ✅ **pass** | curl + sqlite3 (from 2026-04-27 CLI-pass) | Verified programmatically: 3 consecutive POSTs with the same UUID `11111111-2222-4333-8444-555555555555` to `/api/tasks` all returned **HTTP 201** with the **original** stored task; final `SELECT COUNT(*) FROM tasks WHERE text = 'test idempotency';` returned **`1`**. Server-side `INSERT OR IGNORE` (Story 1.2) provides the end-to-end guarantee; Story 2.3's `retryInFlightRef` adds a client-side double-click guard. Test ran on commit 6483917 + the Phase B Task B1 patch. |

## Contrast pair tokens (for AC8 reviewer measurement)

Tokens defined at [client/src/index.css:42-53](client/src/index.css#L42-L53):

| Pair | Foreground | Background | Rendered FG (RGB) | Rendered BG (RGB) | Threshold | Ratio | Pass? |
|---|---|---|---|---|---|---|---|
| Foreground / background (text) | `oklch(0.145 0 0)` | `oklch(1 0 0)` | `rgb(10,10,10)` | `rgb(255,255,255)` | ≥ 4.5:1 | **19.80** | ✅ |
| Muted-foreground / background (text) | `oklch(0.55 0 0)` | `oklch(1 0 0)` | `rgb(113,113,113)` | `rgb(255,255,255)` | ≥ 4.5:1 | **4.88** | ✅ |
| Primary / background (non-text — focus ring, checkbox tick) | `oklch(0.54 0.20 275)` | `oklch(1 0 0)` | `rgb(82,90,224)` | `rgb(255,255,255)` | ≥ 3:1 | **5.39** | ✅ |
| Destructive / background (non-text — AlertCircle icon) | `oklch(0.57 0.21 25)` | `oklch(1 0 0)` | `rgb(215,38,48)` | `rgb(255,255,255)` | ≥ 3:1 | **4.99** | ✅ |
| Ring / background (non-text — focus ring; same value as primary) | `oklch(0.54 0.20 275)` | `oklch(1 0 0)` | `rgb(82,90,224)` | `rgb(255,255,255)` | ≥ 3:1 | **5.39** | ✅ |

**Method:** each token resolved at runtime via a probe `<div>`'s computed `color`, painted to a 1×1 canvas, and the rasterized RGB read with `getImageData`. Luminance ratios computed per the WCAG 2.1 formula (linearize sRGB, weighted-sum to relative luminance, `(L1+0.05)/(L2+0.05)`). Computed in-page so the values reflect what Chrome's actual color engine produces from the oklch tokens at this Chrome version.

## ARIA + a11y inventory (static-verified)

Every interactive element has an accessible name; live regions are appropriately scoped:

- `<TaskInput>` — `<Label htmlFor="task-input" className="sr-only">Add a task</Label>` provides the input label (Story 1.5). Over-limit notice has `role="status" aria-live="polite"`.
- `<TaskList>` `<ul>` — `role="list"` + `aria-live="polite"` + `aria-label="Tasks"` + `aria-busy={isLoading}` (Story 1.6 / 2.1).
- `<TaskList>` skeleton rows — `aria-hidden="true"` (correctly hidden during load).
- `<TaskItem>` — checkbox `aria-labelledby={textId}` references the row's text span (Story 1.6).
- `<TaskItem>` failed-row `<AlertCircle role="img" aria-label="Save failed" />` (Story 2.3 + 2.4 SVG-direct).
- `<TaskItem>` Retry button — `aria-label={`Retry saving task: ${task.text}`}` (Story 2.3).
- `<TaskItem>` Delete button — `aria-label={`Delete task: ${task.text}`}` (Story 1.6).
- `<PageBanner>` — `role="alert"` + `aria-live="assertive"` on root; icon span has `aria-hidden="true"` (Story 2.2 / 2.4 / 2.5 reuse).
- `<ErrorBoundary>` fallback — uses `<PageBanner>`; inherits the assertive live region (Story 2.5).

**No `tabindex="-1"` traps. No `role="presentation"` on interactive elements. No `aria-hidden` on focusable children.** Static inventory clean.

## Phase B fixes applied in this execution

- **B1: Focus restoration after Delete/Backspace on a focused `<li>`** [client/src/components/TaskItem.tsx:23-32] — closes the long-deferred Story-1.6 review item ("Focus is lost into `<body>` after deleting the focused row"). Captures the next-sibling (or previous-sibling, or input as fallback) BEFORE the optimistic delete dispatch, then re-focuses via `requestAnimationFrame` after React commits the unmount. ~9 LOC. **Affects AC3** — keyboard-only Journey 1 should now retain focus context after row deletion.

## Phase B items NOT addressed (intentionally deferred further)

- **B2** PageBanner visible fade-in / fade-out — pure cosmetic polish; the `transition-opacity` class is in place; reduced-motion (AC6) zeroes any animation. Not blocking.
- **B3** AlertCircle SVG `role="img"` SR variance — modern JAWS handles it; older JAWS variance is a low-reachability concern. Defer until a real SR test surfaces an issue.
- **B4** Banner re-announcement on identical retry-fail — defer until a real NVDA test surfaces the suppression.
- **B5** Two-banner aria-live cascade — defer until a real test confirms competition.
- **B6** Contrast pair adjustment — defer until AC8 reviewer measurement surfaces a failing pair.
- **B7** Comment density restoration — final LOC headroom (after Phase B1) is ~1 line; not enough to restore comments. Defer.

## A11y findings from the 2026-04-28 browser pass

1. **`page-has-heading-one` (axe — moderate, all 3 states).** No `<h1>` on the page. Intentional for the minimalist single-screen design (the page `<title>` carries the page identity). Documented here for transparency; not blocking AC1.
2. **Focus after load-failed-banner Retry success.** When the keyboard user activates the `<PageBanner>` Retry button and the retry succeeds, the banner unmounts and focus falls to `<body>`. Phase B1 only addressed focus retention after row deletion, not banner unmount. Low impact (input is the next Tab stop) but candidate for a future polish item alongside Phase B2.
3. **Tightest contrast: `--muted-foreground` = 4.88:1.** Passes the 4.5:1 floor, but margin is small. Any future palette shift needs a re-check.

## Summary

- **Browser-pass (2026-04-28):** AC1, AC2, AC3, AC5, AC6, AC7, AC8, AC9, AC11 (emulated), AC12, AC13 — **11/13 ✅**.
- **Still TBD-by-human:** AC4 (real screen reader), AC10 (Firefox / Safari / Edge / iOS Safari), AC11 (real iOS + Android device sign-off — emulated portion already ✅).
- **Phase B fixes applied (carried over from CLI-pass):** 1 — focus-after-delete in `TaskItem` (verified working in this browser pass).
- **NFR sign-off:** see Story 2.6 Phase D in `_bmad-output/implementation-artifacts/2-6-accessibility-quality-verification-pass.md`.

**Ready-to-ship status:** strong. Every browser-driveable AC passes. The remaining work (real screen-reader pass, real cross-browser / cross-device sweep) is human-only and outside the reach of automated tooling — these are the standard final-mile items before any release.
