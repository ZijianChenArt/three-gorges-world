# 全部保留 / All Assets Retained.

An autonomous artwork about an archive that retains its registrations while progressively destroying the geometry of what it registers. New source instances continue to arrive, and empty records accumulate behind them.

## Line / surface parameters

The drawing background is pure white (#FFFFFF). The visible artwork has no title or concept paragraph. Only numerical record IDs, spatial links, render status, R/E/L/F parameters remain. There is no visible toolbar, control button or help modal. Keyboard and direct-touch controls are described here and in the canvas accessible label.

Each selected surviving source edge produces exactly one uninterrupted polyline. Its endpoints are the actual current quantized vertices. Subdivision samples the same local deformation as the selected model's surfaces, allowing its own edges to bend and disperse during the response. There is no separate bowing-arc layer, split gap, time-varying line-visibility gate or duplicate entry outline. LOD selection remains bounded. Native WebGL lines use stable0.55 opacity; compatibility lines are0.55 CSS px on desktop and0.6px on phones.

The full original GLB is partitioned into three disjoint source-local spatial patches. At each quantization stage their union is exactly the complete surviving mesh, with shared original position, normal and morph buffers. Surface patches retain their gentle asynchronous presentation; source-edge visibility remains stable. Surface visibility uses physical-material opacity in small one-twelfth steps, while edges retain stable opacity. These display phases never restore logically deleted edges or faces. No fullscreen flash or rapid strobe is used.

- R: cumulative registrations.
- E: actual surviving logical structural edges, before rendering subdivision.
- L: submitted source-edge sample segments; Canvas reports the clipped segments actually drawn, while PBR reports GPU-submitted segments.
- F: submitted visible-patch triangles (sampled actual source faces in compatibility mode, full original mesh faces in PBR).

Desktop edge-field work is capped at1,200 source edges ×6 segments; phone uses540 ×4. Surface batches are bounded by three patches per active instance and share geometry/materials. Line buffers are fixed-size. A source at the erased stage submits no model faces or curves. Reduced motion freezes all representation phases, and pause freezes their shared clock.

## Real 3D renderer

The primary renderer uses Three.js WebGL2 and all 28,384 original GLB triangles across five sources and29 mesh parts. It is no longer a Canvas-only material approximation.

- Ten shared finishes: polished chrome, rough metal, clear glass, satin-cut metal, smoked glass, cobalt lacquer, oxide ceramic, amber glass, lime–violet gradient glass and violet–blue gradient metal use built-in MeshStandardMaterial / MeshPhysicalMaterial.
- A generated RoomEnvironment is prefiltered through PMREM for environment illumination and reflections. No external HDR service or image is required.
- ACES tone mapping, environment lighting and directional illumination provide depth and surface response. A transparent shadow receiver draws only soft ground shadows; no ground mirror or opaque floor color is present.
- Glass uses transmission, thickness and index of refraction, rather than pretending low opacity is physical glass. Phone transmission resolution and roughness are reduced for cost.
- InstancedMesh batches share source/stage geometry and materials. Each instance carries an independent matrix and GPU morph weight.

These are physically based rasterized materials, not ray tracing. Built-in Three.js instanced-morph and PBR paths are used for ordinary instances. Relevant official references: [physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [PMREM environments](https://threejs.org/docs/pages/PMREMGenerator.html), and [instanced morphs](https://threejs.org/docs/pages/InstancedMesh.html).

## Geometry loss is real

Full GLB mesh parts are transformed into the same local normalized coordinates as the structural-edge archive. The original source triangles, apertures, part transforms and initial normals are preserved exactly at registration.

Six successive spatial quantizations operate on the previous surviving coordinates, retaining double precision during one-time preparation to avoid half-grid drift. Each transition has one shared next-position and next-normal morph target. During processing, the GPU interpolates the actual vertices and normals. At a commit, duplicate and degenerate triangles are removed from the shared index. Final triangle counts are zero for all five sources; those mesh instances are removed from rendering.

The displayed structural-edge count is the actual count of surviving crease/boundary edges, not the full triangulation edge count. It follows the same quantization process. Registry frames are separate annotations and are not model geometry. The renderer also exposes actual surviving mesh triangle counts for validation.

The automatic processing/intake clock runs at1.55× the previous release pace. Source and stage geometry remain shared and unchanged.

## More simultaneous instances and continued accumulation

The first view contains12 instances on desktop or8 on phones, instead of3. Intake becomes faster as independent copies retire. The default PBR admission budget is26 desktop /16 phone, dynamically adjusted to drawing cost, with a strict32-instance safety bound. Detailed geometry is shared, not cloned into a growing mesh pool.

Each instance slowly rotates on independently seeded axes and drifts within a small bounded neighborhood. These poses are shared by the physical mesh, curves, registry labels and picking. Pause freezes this motion; reduced-motion preference suppresses it.

The initial12 include all ten finishes, with two gradient instances. Later admissions select acid gradients about23% of the time, alongside neutral and solid-color finishes. Two shared1×128 RGBA maps use1KiB of pixel data in total. Original source-local UVs remain attached through processing, patch views and local responses; there is no per-face random coloring. Canvas compatibility uses source-height facet tints and does not claim physical transmission or smooth GPU texture rendering.

Cumulative registrations never reset. Old records are represented by exact-count archive bundles, excluding active instances. Detailed instances, recent descriptors and bundle rendering remain bounded. This provides increasing density and archived totals without unbounded RAM or scene-object growth. New forms are copies and transformations of the five real sources, not newly generated AI assets.

## Ground mirror removed

The global planar mirror, capture render target and reflection pass are removed. The physical renderer has a transparent ShadowMaterial receiver, with a1024px desktop or512px phone shadow map. It draws no solid floor color. Canvas compatibility adds no fake mirror or shadow plane. The original sculpture pedestals remain unchanged. Physical material reflections and environment illumination remain, and soft cast shadows follow the surviving geometry. Erased mesh stages stop casting.

## Explicit compatibility path

If WebGL2 is unavailable, initialization fails or the context is lost, the same autonomous process continues in a clearly labeled Canvas line-drawing compatibility mode. It is not presented as the realistic PBR result. The fallback retains the larger initial population, exact structural counts, optional controls and bounded archive.

## Viewing and accessibility

The camera moves automatically. One-finger/mouse drag rotates naturally; two fingers pan and pinch; right mouse drag pans; the wheel zooms. These controls change observation, never the processing rule. After2.4 seconds without navigation, manual offsets blend smoothly back into the automatic path. Single-pointer presses remain pending until a6px drag threshold; two fingers take over immediately. The automatic camera continuously changes between wide panoramic rotation, approach, interior weaving and pullout. The 144-second envelope has no hard cuts or reset jumps. In the interior phase it travels through the occupied model group and looks ahead along its route. It adapts to current instance placement with conservative clearance, using a small near plane for interior views. This is bounding-volume guidance, not triangle-level collision detection. Only recognized navigation freezes the base view and resumes it with a smooth blend. A stationary tap or Enter impulse has no effect on the automatic camera clock or pose.

Pause stops the process and automatic view but leaves manual inspection available. Tap a visible surviving form to scatter and gather only that instance's current vertices and source curves. Enter activates it at a central visible curve. A hit-local impulse starts within the next drawing frame and returns within1.5 seconds; all instance poses and every unselected model stay unchanged. At most two independently selected targets can respond at once, and repeat taps cannot reset an active wave. The regular shared source buffers remain immutable. Temporary target-owned position, normal and index buffers follow the current quantization stage and are disposed when the response ends. Logically erased geometry cannot be selected or restored. User-triggered responses finish even while processing is paused; reduced motion replaces deformation with a soft0.22-second local color fade.

Picking uses submitted curves/triangles, not whole registration boxes. Pointer-down latches the exact hit model and local surface position, so a moving camera cannot switch the selected object before a stationary tap is released. Cancelled gestures and pinch transitions cannot emit ghost taps. The PBR path additionally raycasts actual current mesh patches with per-instance morph weights, including the deformed temporary geometry. Empty space and erased records do nothing.

The selected model's existing edges can receive a temporary restrained tint during the same local impulse. No offset fringes, additional arcs or particles are created.

Visible point marks and their animation/GPU resources are removed. There is no P counter. Soft ground shadows, environment lighting and physical material response remain.

Keyboard arrows rotate, Shift+arrows pan, +/− zoom, Home resets and Space pauses. Reduced-motion preference begins paused and suppresses automatic flight even if processing is manually resumed. Hidden tabs suspend execution without skipping unseen time. The visible control cluster and modal have been removed; Space pauses and Home resets the view.

Both rendering layers use the full viewport. Actual geometry is clipped before perspective division, retaining local coordinates for picking; repeated equal-size resize events do not clear the drawing buffer. These fix identified edge-instability risks, without claiming a device-specific GPU diagnosis.

Selection/callout suppression remains scoped to the artwork. No rapid flashing is used.

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
