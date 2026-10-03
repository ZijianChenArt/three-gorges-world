# 全部保留 / All Assets Retained.

An autonomous web artwork in the form of a fictional retention procedure. Five actual source sculptures are registered, then repeatedly quantized, merged and reduced. Their geometry reaches zero while their numbered records and original bounding volumes remain. Further source copies enter as new records with different deterministic placements, sizes and rotations.

The contradiction is performed by the geometry and register, not by a score. There is no AI judgement, quality metric, visitor task, or claim that the source files are destroyed.

## The procedure

Each intake begins with the original 5,789 crease/boundary edges. Original coordinates are normalized uniformly per sculpture. Successively coarser grids move the surviving vertices continuously to their nearest grid points. At each commit, duplicate edges and zero-length edges are removed. Each stage starts from the previous stage, so discarded topology never resurrects within an instance.

After approximately one minute, the five current instances have no model edges or nondegenerate faces. Empty records remain for 12 seconds, followed by an explicit source-copy reload notice. New instances arrive separately in the next intake. The current effective-edge count is the sum of actual `activeEdges` arrays. Registration counts increase only when a new numbered instance enters. Empty historical records are represented by deterministic serial numbers; only the most recent history layer is drawn, keeping memory and rendering bounded.

Black and gray facets are sampled original mesh triangles, never convex hulls or invented caps. Their vertices undergo the same quantization and degenerate faces are discarded. Thin bounding frames are registry annotations and are not included in model edge counts. A narrow record strip and in-space identifiers continue to operate normally as the scene becomes empty.

## Watching and optional inspection

The camera follows a slow continuous path automatically. No interaction is needed to see the full work. Optional one-finger/mouse dragging rotates the actual projected scene, in the natural direct-manipulation direction. Two fingers pan and pinch-zoom; right mouse dragging pans, and the wheel zooms. These actions change only the view, never the retention procedure.

After eight seconds without inspection, automatic camera movement resumes and manual offsets blend away smoothly. Pause stops both the procedure and automatic camera; manual inspection remains available. Reset View returns to the automatic view. Keyboard arrows rotate, Shift+arrows pan, +/− zoom, Home resets, and Space pauses/plays.

The iOS callout and selection suppression is scoped to the canvas and decorative overlays. Explanation text remains selectable. Reduced-motion preference starts the work paused. Hidden tabs and the explanation dialog suspend execution without skipping unseen time. There is no rapid flashing or full-screen strobe.

## Assets

- Memory Aperture / 记忆孔径
- Resonance Garden / 共振花园
- Data Cloud / 数据云
- Echo Chamber / 回声室
- Phase Bloom / 相位花

The original `models/three-gorges.glb` is unchanged. Its legacy filename and repository name do not describe a dam reconstruction. `models/sculpture-wireframes.json` contains 5,789 actual crease/boundary edges; `models/sculpture-faces.json` contains 2,000 actual source triangles. Reproducible extraction scripts and asset notes are included under `scripts/` in the source package. The original Blender project is retained in the repository's `artwork/` directory. Earlier artwork versions remain in Git history.

## Runtime and development

Canvas 2D projects the three-dimensional geometry, so WebGL/GPU support is not required. Phone and desktop compositions use the same process with different spatial framing. There is no backend, analytics, upload, external font, browser storage, runtime CDN, audio, or AI call. State lasts only for the current page visit.

Use Node.js 22.12+ or 24+. From the `source/` folder:

```sh
npm ci
npm run dev
npm run check
npm run preview
```

`npm run check` runs tests and builds `dist/`. The static production package is deployed to the existing GitHub Pages site with relative URLs. Original model source files are supplied alongside the runnable source. This is an artwork depicting a fictional procedure, not an archival tool or a recommendation for real preservation work.
