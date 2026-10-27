# Arena layout requirement

The user requires Arena's battle viewport to remain fixed at the central 80% of the browser width (80vw), full viewport height (100dvh), with 10vw gutters on each side, matching the approved screenshot on 2026-10-25.

Future UI must use side gutters or floating overlays. Never resize, shift, or reflow the battle viewport when adding HUD, ID cards, panels, deployment controls, or other features. Camera zoom and pan may affect map content only, never the outer frame. Preserve this unless the user explicitly requests a layout change. The final CSS contract is #arena-viewport-contract in Arena game.html.

# Fast and safe editing workflow

The owner's priority is fast, narrowly scoped game edits without requiring programming decisions from them.
- Read only the files, functions, and dependencies relevant to the requested change. Avoid repository-wide scans unless necessary.
- Treat `Arena game.html` as the single canonical Arena engine. `index.html` is a compatibility redirect, not a second engine. Never duplicate the engine back into `index.html`.
- `studio.html` hosts the canonical engine in an iframe. Map geometry, default units and artwork live in `campaigns/<campaign>/map.json` and `background.png`, loaded by `campaigns/map-runtime.js`. Edit those map files rather than hardcoding geometry or images into the engine.
- Prefer minimal diffs, retain game behavior and existing UI layout, and avoid unrelated refactors. For substantial changes, make a separate branch and PR.
- Do not edit generated or duplicated output instead of the canonical source. Check dependencies before moving data out of large HTML files.
- Before submitting, validate affected JavaScript/JSON and verify changed load paths; if runtime testing is unavailable, state that explicitly.

# Repeatable development tools

- Read `docs/DEVELOPMENT.md` for the code ownership map. Embedded `src/...ts` labels are not separate source files.
- Use `npm run inspect -- --find "symbol"` or `--module inputRouter` to locate code without dumping embedded image data.
- `npm run check` validates all pages, scripts, JSON, links and campaign descriptors. `npm test` also builds the deployment artifact and runs isolated browser regressions, including Jay melee and ranged attacks.
- `npm run dev` starts a loopback preview. `npm run build` is the same allowlisted packaging used by Pages. Add new public resource directories to `tools/site.mjs`.
- Do not commit generated `_site/`, installed dependencies or test screenshots. Run meaningful checks before opening a PR; report any actual failures.
- Routine implementation decisions are the agent's responsibility. The owner wants to describe behavior, not choose programming details. Preserve their explicit constraints and deletions.
- Read `campaigns/README.md` before adding a map. The shared map validator is used by Node checks and the browser. A map loading error must be visible, never silently replaced with another map.
- Await `ArenaCampaignReady` / `ArenaCampaignLoaded` before using deployment APIs. Verify full HTML exports with networking disabled after changes to map loading or assets.
