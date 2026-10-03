# 异构场 · SCULPTURE FIELD

A small, independent real-time 3D exhibition built with vanilla JavaScript, Three.js and Vite. It is designed for GitHub Pages and has no backend, account system, analytics, external font, or runtime CDN dependency.

## The artwork

Five original Blender-made media-art sculptures occupy a shared field:

1. Memory Aperture: a layered suspended structure inside an open ring
2. Resonance Garden: a wave of repetitive metal fins
3. Data Cloud: suspended geometric fragments above concentric rings
4. Echo Chamber: a sequence of offset portals
5. Phase Bloom: a twisted, faceted metallic flower

This is a new art scene, **not a reconstruction of the Three Gorges Dam**. The repository name retains the initial experiment name; the visible exhibition is Sculpture Field.

## Why this stack

- **Three.js** offers direct scene, camera, light and material control. A conventional OrbitControls camera works with mouse, trackpad and touch without a UI framework.
- **GLB (glTF 2.0)** carries the complete asset in one portable binary. Blender can export it natively, and replacing it does not require changing rendering code.
- **Vite** produces compact static assets with reproducible dependency versions. A relative `base: './'` works on a repository subpath or custom domain.
- **Vanilla JS/CSS** keeps the controls and scene configuration easy to inspect and extend. No React runtime or 3D abstraction layer is needed for this size of exhibition.

Official references: [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [RoomEnvironment](https://threejs.org/docs/pages/RoomEnvironment.html), [Vite static deployment](https://vite.dev/guide/static-deploy.html).

## Develop

Use Node.js 22.12+ or 24+.

```sh
npm ci
npm run dev
npm run check
npm run preview
```

`npm run check` runs the structural/configuration checks and makes a production build. The production site is in `dist/`. Serve it over HTTP rather than opening the HTML as a local file.

## Controls

- Drag to orbit; wheel/pinch to zoom
- Right-drag or two fingers to pan
- Six curated viewpoints, also on keyboard keys 1–6
- R resets to the overview
- 实体: pale sculptural material study
- 信号: emissive wireframe with a moving scan band
- 原色: the original Blender PBR materials
- 漫游: slow automatic orbit; press again to stop
- Full-screen is offered only when the browser reports support
- The views panel collapses; it starts collapsed on phones

Reduced-motion preference disables ambient animation and camera transitions. Touch devices receive a lower pixel-ratio and shadow-map budget. Safari/iOS 16.4+ is the build target; actual device/GPU compatibility also depends on WebGL 2 availability. The site shows an honest static-preview error state if WebGL or the asset is unavailable. A stalled asset request times out after 45 seconds and offers a retry.

## Add or replace models

1. Export a `.glb` from Blender, including materials. Apply modifiers. Keep textures modest and avoid shipping hidden high-poly meshes. Prefer under 10 MB for comfortable phone loading.
2. Put the asset in `public/models/`.
3. Edit `src/config.js`: `WORLD.model.url`, visible credit/provenance and the desired `normalizedSize`.
4. Add or edit `WORLD.views`. Each viewpoint supplies an ID, title, subtitle, position, target and a short description. Positions use **Y-up normalized world coordinates**. Optional `group` names a GLB root group for the aspect-aware camera fitting.
5. Build and inspect every view on desktop and portrait phone layouts.

The viewer centers the loaded GLB in X/Z, moves its lowest point to Y=0 and scales its longest dimension to `normalizedSize` (currently 22). Model geometry and proportions are not otherwise changed. The supplied asset has five named root groups and eight materials. It is about 1.06 MB, 29 mesh groups and 28,384 triangles, with no texture downloads.

`WORLD.appearance` defines the three presentation palettes. Original GLB materials are preserved and restored in 原色 mode. Environment lighting is generated locally using RoomEnvironment; no HDR files are required.

To host several independent exhibitions, add separate configuration objects and load the selected GLB. To keep multiple models together, export them as named groups in one GLB or extend the loading function to add several roots. Keep credits/provenance accurate when substituting assets.

## GitHub Pages

The prepared publish package serves the production files from the repository root. Editable app files live under `source/`.

1. In GitHub Settings → Pages, select Deploy from a branch.
2. Select `main` and `/(root)`.
3. Commit the **contents** of `dist/` at the repository root, preserving `.nojekyll`, `assets/`, `models/` and `images/`.
4. Keep the editable project under `source/` and the original Blender project under `artwork/`.

For later updates, run `npm ci && npm run check` inside `source/`, then replace the root production files with the new `source/dist/` contents. No GitHub Actions workflow is required. Do not publish `node_modules/` or local browser-test output.

## Testing

`tests/config.test.js` checks valid view data, URL selection, relative asset paths, GLB structure, compact asset size, provenance text and required controls/fallback files.

`scripts/visual-check.mjs` is an optional Playwright screenshot workflow. It expects an HTTP preview at `http://localhost:4173` and Chromium at `/usr/bin/chromium`; adjust the executable path for your machine. It checks the default, signal, close-up, monochrome and phone-panel views. The source includes Playwright only as a development dependency.

## Files

- `src/main.js`: renderer, scene, asset loading, controls and interaction
- `src/config.js`: editable exhibition metadata, views and palettes
- `src/camera-fit.js`: aspect-aware framing for desktop, tablet and phone
- `src/style.css`: responsive interface
- `public/models/three-gorges.glb`: the original sculpture-garden GLB (legacy experiment filename)
- `public/images/preview.webp`: lightweight static artwork preview
- `index.html`: semantic controls, loading/error and about dialog

Dependency license text is included in the built `THIRD_PARTY_LICENSES.txt`. No license is implied for the creator's original artwork or application code.
