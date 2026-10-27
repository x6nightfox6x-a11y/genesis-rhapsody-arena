# Arena layout requirement

The user requires Arena's battle viewport to remain fixed at the central 80% of the browser width (80vw), full viewport height (100dvh), with 10vw gutters on each side, matching the approved screenshot on 2026-10-25.

Future UI must use side gutters or floating overlays. Never resize, shift, or reflow the battle viewport when adding HUD, ID cards, panels, deployment controls, or other features. Camera zoom and pan may affect map content only, never the outer frame. Preserve this unless the user explicitly requests a layout change. The final CSS contract is #arena-viewport-contract in Arena game.html.

# Fast and safe editing workflow

The owner's priority is fast, narrowly scoped game edits without requiring programming decisions from them.
- Read only the files, functions, and dependencies relevant to the requested change. Avoid repository-wide scans unless necessary.
- Treat `Arena game.html` as the single canonical Arena engine. `index.html` is a compatibility redirect, not a second engine. Never duplicate the engine back into `index.html`.
- `studio.html` hosts the canonical engine in an iframe; `campaigns/` currently provides campaign selection metadata and does not yet extract the old map. Do not claim map extraction is complete.
- Prefer minimal diffs, retain game behavior and existing UI layout, and avoid unrelated refactors. For substantial changes, make a separate branch and PR.
- Do not edit generated or duplicated output instead of the canonical source. Check dependencies before moving data out of large HTML files.
- Before submitting, validate affected JavaScript/JSON and verify changed load paths; if runtime testing is unavailable, state that explicitly.
