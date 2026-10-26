# Arena layout requirement

The user requires Arena's battle viewport to remain fixed at the central 80% of the browser width (80vw), full viewport height (100dvh), with 10vw gutters on each side, matching the approved screenshot on 2026-10-25.

Future UI must use side gutters or floating overlays. Never resize, shift, or reflow the battle viewport when adding HUD, ID cards, panels, deployment controls, or other features. Camera zoom and pan may affect map content only, never the outer frame. Preserve this unless the user explicitly requests a layout change. The final CSS contract is #arena-viewport-contract in Arena game.html.