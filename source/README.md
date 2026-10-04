# 全部保留 / All Assets Retained.

An autonomous artwork about an archive that retains its registrations while progressively destroying the geometry of what it registers. New source instances continue to arrive, and empty records accumulate behind them.

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

## More simultaneous instances and continued accumulation

The first view contains12 instances on desktop or8 on phones, instead of3. Intake becomes faster as independent copies retire. The default PBR admission budget is26 desktop /16 phone, dynamically adjusted to drawing cost, with a strict32-instance safety bound. Detailed geometry is shared, not cloned into a growing mesh pool.

Cumulative registrations never reset. Old records are represented by exact-count archive bundles, excluding active instances. Detailed instances, recent descriptors and bundle rendering remain bounded. This provides increasing density and archived totals without unbounded RAM or scene-object growth. New forms are copies and transformations of the five real sources, not newly generated AI assets.

## Explicit compatibility path

If WebGL2 is unavailable, initialization fails or the context is lost, the same autonomous process continues in a clearly labeled Canvas line-drawing compatibility mode. It is not presented as the realistic PBR result. The fallback retains the larger initial population, exact structural counts, optional controls and bounded archive.

## Viewing and accessibility

The camera moves automatically. One-finger/mouse drag rotates naturally; two fingers pan and pinch; right mouse drag pans; the wheel zooms. These controls change observation, never the processing rule. After eight seconds without inspection, manual offsets blend back into the automatic path.

Pause stops the process and automatic view but leaves manual inspection available. Keyboard arrows rotate, Shift+arrows pan, +/− zoom, Home resets and Space pauses. Reduced-motion preference begins paused. Hidden tabs and the explanation dialog suspend execution without skipping unseen time.

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
