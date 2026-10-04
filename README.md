# 全部保留 / All Assets Retained.

An autonomous artwork about an archive that retains its registrations while progressively destroying the geometry of what it registers. New source instances continue to arrive, and empty records accumulate behind them.

## Point / line / surface parameters

The visible artwork has no title or concept paragraph. Only numerical record IDs, spatial links, render status, R/E/P/L/F parameters and accessible icon controls remain. The tucked-away help contains the parameter key and controls.

Curved polylines are constructed from actual surviving structural edges. Their endpoints follow the current quantized vertices; source-local normals bow them into curves, and smooth interior gaps expose corresponding points. No independent decorative particle cloud is added. Selection is deterministic and bounded. The physical renderer uses real Three.js LineSegments and Points in the same 3D scene, rather than drawing model strokes over a 2D overlay.

The full original GLB is partitioned into three disjoint source-local spatial patches. At each quantization stage their union is exactly the complete surviving mesh, with shared original position, normal and morph buffers. Slow asynchronous point/line/surface phases reveal different local representations. Surface visibility uses physical-material opacity in small one-twelfth steps, while curves and points use continuously varying local weights. These display phases never restore logically deleted edges or faces. No fullscreen flash or rapid strobe is used.

- R: cumulative registrations.
- E: actual surviving logical structural edges, before rendering subdivision.
- P: source-bound points submitted for display.
- L: submitted curve sample segments; in Canvas compatibility mode this also includes the brief exact-source outline at entry.
- F: submitted visible-patch triangles (sampled actual source faces in compatibility mode, full original mesh faces in PBR).

Desktop edge-field work is capped at1,200 source edges ×6 segments, plus580 source-bound points; phone uses540 ×4 and260 points. Surface batches are bounded by three patches per active instance and share geometry/materials. Line and point buffers are fixed-size. A source at the erased stage submits no model faces, curves or points. Reduced motion freezes all representation phases, and pause freezes their shared clock.

## Real 3D renderer

The primary renderer uses Three.js WebGL2 and all 28,384 original GLB triangles across five sources and29 mesh parts. It is no longer a Canvas-only material approximation.

- Physical silver metal, rough dark surfaces, glass transmission and brushed-looking metal use built-in MeshStandardMaterial / MeshPhysicalMaterial.
- A generated RoomEnvironment is prefiltered through PMREM for environment illumination and reflections. No external HDR service or image is required.
- ACES tone mapping, environment lighting, directional illumination and PCF soft shadow maps provide depth and surface response.
- Glass uses transmission, thickness and index of refraction, rather than pretending low opacity is physical glass. Phone transmission resolution and roughness are reduced for cost.
- InstancedMesh batches share source/stage geometry and materials. Each instance carries an independent matrix and GPU morph weight.

These are physically based rasterized materials, not ray tracing. No custom shader patch is required: the built-in Three.js instanced-morph and PBR paths are used. Relevant official references: [physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [PMREM environments](https://threejs.org/docs/pages/PMREMGenerator.html), and [instanced morphs](https://threejs.org/docs/pages/InstancedMesh.html).

## Geometry loss is real

Full GLB mesh parts are transformed into the same local normalized coordinates as the structural-edge archive. The original source triangles, apertures, part transforms and initial normals are preserved exactly at registration.

Six successive spatial quantizations operate on the previous surviving coordinates, retaining double precision during one-time preparation to avoid half-grid drift. Each transition has one shared next-position and next-normal morph target. During processing, the GPU interpolates the actual vertices and normals. At a commit, duplicate and degenerate triangles are removed from the shared index. Final triangle counts are zero for all five sources; those mesh instances are removed from rendering.

The displayed structural-edge count is the actual count of surviving crease/boundary edges, not the full triangulation edge count. It follows the same quantization process. Registry frames are separate annotations and are not model geometry. The renderer also exposes actual surviving mesh triangle counts for validation.

The automatic processing/intake clock runs at1.55× the previous release pace. Source and stage geometry remain shared and unchanged.

## More simultaneous instances and continued accumulation

The first view contains12 instances on desktop or8 on phones, instead of3. Intake becomes faster as independent copies retire. The default PBR admission budget is26 desktop /16 phone, dynamically adjusted to drawing cost, with a strict32-instance safety bound. Detailed geometry is shared, not cloned into a growing mesh pool.

Cumulative registrations never reset. Old records are represented by exact-count archive bundles, excluding active instances. Detailed instances, recent descriptors and bundle rendering remain bounded. This provides increasing density and archived totals without unbounded RAM or scene-object growth. New forms are copies and transformations of the five real sources, not newly generated AI assets.

## Explicit compatibility path

If WebGL2 is unavailable, initialization fails or the context is lost, the same autonomous process continues in a clearly labeled Canvas line-drawing compatibility mode. It is not presented as the realistic PBR result. The fallback retains the larger initial population, exact structural counts, optional controls and bounded archive.

## Viewing and accessibility

The camera moves automatically. One-finger/mouse drag rotates naturally; two fingers pan and pinch; right mouse drag pans; the wheel zooms. These controls change observation, never the processing rule. After2.4 seconds without inspection, manual offsets blend smoothly back into the automatic path. The automatic camera now follows a continuous world-space perspective flight, with lateral translation, depth parallax and dolly motion rather than a small orthographic wobble.

Pause stops the process and automatic view but leaves manual inspection available. Tap a visible surviving form to emit a spatial ripple that temporarily displaces nearby existing instances; Enter activates it at the central visible form. The wave propagates through3D space and returns home within4.76 seconds. At most four waves coexist. It never recreates deleted edges or triangles. User-triggered ripples finish even when the archive is paused; reduced motion suppresses their displacement.

Keyboard arrows rotate, Shift+arrows pan, +/− zoom, Home resets and Space pauses. Reduced-motion preference begins paused and suppresses automatic flight even if processing is manually resumed. Hidden tabs and the explanation dialog suspend execution without skipping unseen time.

Selection/callout suppression is scoped to the artwork; explanation text stays copyable. No rapid flashing is used.

## Assets and development

The original GLB and Blender source remain unchanged. The inherited filename `three-gorges.glb` does not describe a dam reconstruction. The five sources are Memory Aperture, Resonance Garden, Data Cloud, Echo Chamber and Phase Bloom. Prior releases remain in Git history.

There is no backend, analytics, upload, storage, AI call or paid service. The only runtime model fetch is the bundled original GLB from this site's own directory. State is confined to the visit.

Use Node.js22.12+ or24+. From `source/`:

```sh
npm ci
npm run dev
npm run check
npm run preview
```

`npm run check` runs the tests and builds the static relative-URL package. The full runnable source and extraction scripts are included. This is a fictional procedure, not preservation software or advice.
