# Board Skin Viewer

A static, JSON-driven renderer for Monopoly-style game boards. No game logic —
it only visualizes whatever "skin" (JSON config) you point it at. Built to run
straight from GitHub Pages: no build step, no dependencies beyond two Google
Fonts loaded via `<link>`.

## Files

```
index.html               shell + skin picker + inspector panel
styles.css                all styling
app.js                     renderer (reads config, builds the CSS grid board)
configs/manifest.json     list of skins shown in the dropdown
configs/*.json             individual skin configs (two originals included as demos)
New-BoardSkeleton.ps1     PowerShell scaffolder for new board skins
```

## Hosting on GitHub Pages

Drop the whole folder into a repo (e.g. a new repo, or a subfolder of an
existing `drivetimebm.github.io` repo) and enable Pages. Everything is
relative-pathed, so it works from a project subpath too
(`drivetimebm.github.io/board-viewer/`).

## Adding a skin

1. Run the PowerShell scaffolder to get the row/col grid positions computed
   for you:

   ```powershell
   .\New-BoardSkeleton.ps1 -SpacesPerSide 9 -Id "my-skin" -Name "My Skin"
   ```

   This writes `configs/my-skin.json` with all 40 spaces (for the default
   9-per-side / 11x11 classic layout) already placed on the grid, with
   placeholder names/types for you to fill in.

2. Edit the generated file: fill in `name`, `type`, `colorGroup`, `image`,
   `icon`, `subtext` for each space, and the `theme` / `center` blocks.

3. Add an entry to `configs/manifest.json`:

   ```json
   { "id": "my-skin", "name": "My Skin", "file": "configs/my-skin.json" }
   ```

4. Reload `index.html` — it'll show up in the dropdown. You can also test a
   skin without touching the manifest by using the "Custom JSON" file picker
   on the page, which loads any local `.json` file directly in the browser.

## JSON schema

Full field-by-field documentation lives as a comment block at the top of
`app.js`. Summary:

- `gridSize` — the board sits in an N×N CSS grid. Corner tracks are drawn
  larger than edge tracks automatically.
- `theme` — board/cell colors, text color, accent color, optional font
  overrides.
- `center` — title/subtitle/image shown in the middle of the board.
- `spaces[]` — one entry per space, each with an explicit `row`/`col` (1
  indexed). Because position is explicit rather than assumed, this isn't
  limited to the classic 40-space perimeter — any grid layout works as long
  as you supply the coordinates. Each space optionally has:
  - `colorGroup` — hex color, rendered as a bar across the top of the cell
    (the classic Monopoly property-group stripe)
  - `image` — URL; falls back to `icon` (emoji/text) if it fails to load
  - `subtext` — small secondary line (price, instruction, etc.)
  - `type` — free-form string, added as a CSS class (`type-corner`,
    `type-property`, ...) so you can hook in extra styling per space kind if
    you want to
  - `rotate` — degrees clockwise, overrides the automatic rotation for that
    one space

### Rotation

Content auto-rotates to face the board's center, matching real Monopoly
boards: bottom edge `0deg`, left edge `90deg`, top edge `180deg`, right edge
`270deg`. Corners default to `0deg` (their art is usually custom/asymmetric
anyway). This is on by default — set top-level `"autoRotate": false` to turn
it off everywhere, or set `"rotate"` on an individual space to override just
that one. Click a space in the viewer to see its effective rotation in the
inspector panel.

## Notes

- The two bundled skins (**Metro Properties**, **Neon Cyber**) are original
  demo content — generic names/mechanics, not reproductions of any
  copyrighted board game's specific property names — included purely to prove
  out multi-skin switching and the rendering logic.
- Clicking any space opens the inspector panel on the right showing its raw
  config fields — handy for checking a new skin's JSON is wired up the way
  you expect, without needing devtools.
- Everything is vanilla JS/CSS (no framework), so it's easy to fold into an
  existing GitHub Pages repo or embed as an iframe elsewhere.
