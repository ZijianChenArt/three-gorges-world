# 全部保留 / All Assets Retained.

An autonomous web artwork in the form of a fictional retention procedure. Source sculptures enter continuously as differently placed, sized, rotated and surfaced copies. Each instance is registered, quantized and reduced to zero geometry. The records keep accumulating.

The contradiction is performed by the geometry and register: the archive grows while the things it claims to retain lose their spatial detail. There is no quality score, AI judgement, visitor task or claim that source files are destroyed.

## Continuous intake and accumulation

A random seed is generated once per visit. There are no fixed groups of five or whole-world resets. Intake times, source selections, transforms, material treatments and individual erasure durations are deterministic functions of that seed. Three initial instances become a more crowded foreground over the following minutes. Every source type appears early, then further copies are selected stochastically.

Each instance has its own registration, quantization and empty-record hold. Vertices move continuously to successively coarser grid points; coincident edges and zero-length edges are removed at each commit. Processing always begins from the previous surviving topology, so deleted detail never resurrects within an instance. All sampled surface triangles follow the same coordinates and degenerate away with the lines.

The effective-edge count is the sum of the actual active-edge arrays of all foreground instances, not a fictional score. Total registrations equal current instances plus closed records. Older records accumulate in a deeper layer of empty wire boxes. At larger counts they become explicitly counted bundles, with exact closed-record ranges and counts; live records are excluded from those bundles.

The total registry is not reset or capped at five. Detailed rendering is necessarily bounded: the default admission budget is 14 desktop / 7 phone, adjusted by observed drawing cost. Reducing this budget delays future intake; it never silently deletes unfinished geometry. At most 16 detailed instances, eight recent history descriptors and 64 desktop / 28 phone archive bundles are held or drawn. This allows accumulating totals without unbounded arrays, meshes or GPU memory.

## Monochrome material appearances

Four stylized Canvas2D treatments are applied to the actual source facets:

- Metal: view-dependent reflected bands and restrained bright edge cues.
- Matte: broad diffuse gray planes without specular response.
- Translucent: low-alpha original facets layered far-to-near, with softer edges.
- Cut: source-anchored hatch lines clipped analytically to the original triangles, plus real plane/edge intersections.

These are intentional graphic approximations, not a physically based renderer or ray tracer. No hulls, invented caps or unrelated black masking planes fill the models' apertures. Hatch and facet budgets are bounded, and there is no rapid flashing or per-frame random jitter.

## Watching and optional inspection

The camera moves slowly on its own. One-finger/mouse dragging rotates the scene in the natural direct-manipulation direction. Two fingers pan and pinch-zoom; right mouse dragging pans, and the wheel zooms. These actions change only the view, never the automatic procedure.

After eight seconds without inspection, automatic camera movement resumes and manual offsets blend away smoothly. Pause stops the procedure and automatic camera; manual inspection remains available. Keyboard arrows rotate, Shift+arrows pan, +/− zoom, Home resets, and Space pauses/plays.

The iOS callout/selection suppression is scoped to the canvas and decorative overlays. Explanation text stays selectable. Reduced-motion preference starts paused. Hidden tabs and the explanation dialog suspend execution without skipping unseen time.

## Preserved source assets

Five actual sculptures remain the source vocabulary: Memory Aperture, Resonance Garden, Data Cloud, Echo Chamber and Phase Bloom. New instances are transformations of these sources, not newly generated AI assets.

The unchanged legacy-named `models/three-gorges.glb` is not a dam reconstruction. `models/sculpture-wireframes.json` contains 5,789 source crease/boundary edges; `models/sculpture-faces.json` contains 2,000 source triangles. Reproducible extractors are included in `source/scripts/`. The Blender project remains in `artwork/`, and prior artwork versions remain in Git history.

## Runtime and development

Canvas2D projects true three-dimensional coordinates without requiring WebGL. There is no backend, analytics, upload, browser storage, external font/CDN, audio or AI call. State lasts only for the current visit.

Use Node.js 22.12+ or 24+. From `source/`:

```sh
npm ci
npm run dev
npm run check
npm run preview
```

`npm run check` runs the tests and builds `dist/`. The static package uses relative URLs for the existing GitHub Pages site. This depicts a fictional procedure; it is not archival software or real preservation guidance.
