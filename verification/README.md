# Verification assets

This directory holds the visual evidence supporting [`/VERIFICATION.md`](../VERIFICATION.md) (Story 2.6).

## Expected files (populated by the human reviewer during the verification pass)

- `achromatopsia.png` — AC5 color-blind sim. Side-by-side: an active task row + a completed task row under Chrome DevTools → Rendering → Emulate vision deficiencies → Achromatopsia. Verifies strikethrough + opacity-60 distinguish completion without color (NFR-A4).
- `zoom-200pct.png` — AC7 200% zoom. Screenshot of the app at 200% browser zoom on a 1280×720 window with at least 3 task rows visible. Verifies no clipping, no horizontal scroll.
- `viewport-320.png`, `viewport-375.png`, `viewport-768.png`, `viewport-1024.png`, `viewport-1440.png`, `viewport-1920.png` — AC9 viewport sweep. One screenshot per width via DevTools device toolbar. Verifies no horizontal scroll, no layout breakage at any width (FR24).

## Capture format

PNG, ≤ 200 KB each. Crop tightly to the relevant area; full-page screenshots are fine if the layout-under-test is the entire viewport. Filenames are exactly as listed above so the cross-references in `VERIFICATION.md` resolve.

## Why this directory is checked in

`VERIFICATION.md` is a shipping artifact (per Story 2.6 AC12); the screenshots are its evidence. They live in source control alongside the doc so future contributors can compare against the baseline measured here.
