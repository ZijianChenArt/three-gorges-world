# 全部保留 / All Assets Retained.

An autonomous artwork about an archive that retains its registrations while progressively destroying the geometry of what it registers. New source instances continue to arrive, and empty records accumulate behind them.

## Line / surface parameters

The visible artwork has no title or concept paragraph. Only numerical record IDs, spatial links, render status, R/E/L/F parameters remain. There is no visible toolbar, control button or help modal. Keyboard and direct-touch controls are described here and in the canvas accessible label.

Curved polylines are constructed from actual surviving structural edges. Their endpoints follow the current quantized vertices; source-local normals bow them into curves, and their interiors open and close smoothly. No independent decorative particle cloud is added. Selection is deterministic and bounded. The physical renderer uses real Three.js LineSegments in the same 3D scene, rather than drawing model strokes over a 2D overlay.

The full original GLB is partitioned into three disjoint source-local spatial patches. At each quantization stage their union is exactly the complete surviving mesh, with shared original position, normal and morph buffers. Slow asynchronous line/surface phases reveal different local representations. Surface visibility uses physical-material opacity in small one-twelfth steps, while curves use continuously varying local weights. These display phases never restore logically deleted edges or faces. No fullscreen flash or rapid strobe is used.

- R: cumulative registrations.
- E: actual surviving logical structural edges, before rendering subdivision.
- L: submitted curve sample segments; in Canvas compatibility mode this also includes the brief exact-source outline at entry.
- F: submitted visible-patch triangles (sampled actual source faces in compatibility mode, full original mesh faces in PBR).

Desktop edge-field work is capped at1,200 source edges ×6 segments; phone uses540 ×4. Surface batches are bounded by three patches per active instance and share geometry/materials. Line buffers are fixed-size. A source at the erased stage submits no model faces or curves. Reduced motion freezes all representation phases, and pause freezes their shared clock.

## Real 3D renderer

The primary renderer uses Three.js WebGL2 and all 28,384 original GLB triangles across five sources and29 mesh parts. It is no longer a Canvas-only material approximation.

- Eight shared finishes: polished chrome, rough metal, clear glass, satin-cut metal, smoked glass, cobalt lacquer, oxide ceramic and amber glass use built-in MeshStandardMaterial / MeshPhysicalMaterial.
- A generated RoomEnvironment is prefiltered through PMREM for environment illumination and reflections. No external HDR service or image is required.
- ACES tone mapping, environment lighting and directional illumination provide depth and surface response. The former flat-colored global floor has been replaced by the shallow planar reflection described below.
- Glass uses transmission, thickness and index of refraction, rather than pretending low opacity is physical glass. Phone transmission resolution and roughness are reduced for cost.
- InstancedMesh batches share source/stage geometry and materials. Each instance carries an independent matrix and GPU morph weight.

These are physically based rasterized materials, not ray tracing. Built-in Three.js instanced-morph and PBR paths are used for ordinary instances; the reflection has a small edge/background-fade shader. Relevant official references: [physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [PMREM environments](https://threejs.org/docs/pages/PMREMGenerator.html), and [instanced morphs](https://threejs.org/docs/pages/InstancedMesh.html).

## Geometry loss is real

Full GLB mesh parts are transformed into the same local normalized coordinates as the structural-edge archive. The original source triangles, apertures, part transforms and initial normals are preserved exactly at registration.

Six successive spatial quantizations operate on the previous surviving coordinates, retaining double precision during one-time preparation to avoid half-grid drift. Each transition has one shared next-position and next-normal morph target. During processing, the GPU interpolates the actual vertices and normals. At a commit, duplicate and degenerate triangles are removed from the shared index. Final triangle counts are zero for all five sources; those mesh instances are removed from rendering.

The displayed structural-edge count is the actual count of surviving crease/boundary edges, not the full triangulation edge count. It follows the same quantization process. Registry frames are separate annotations and are not model geometry. The renderer also exposes actual surviving mesh triangle counts for validation.

The automatic processing/intake clock runs at1.55× the previous release pace. Source and stage geometry remain shared and unchanged.

## More simultaneous instances and continued accumulation

The first view contains12 instances on desktop or8 on phones, instead of3. Intake becomes faster as independent copies retire. The default PBR admission budget is26 desktop /16 phone, dynamically adjusted to drawing cost, with a strict32-instance safety bound. Detailed geometry is shared, not cloned into a growing mesh pool.

Each instance slowly rotates on independently seeded axes and drifts within a small bounded neighborhood. These poses are shared by the physical mesh, curves, reflection, registry labels and picking. Pause freezes this motion; reduced-motion preference suppresses it.

The initial12 include all eight materials with three colored accents. Later admissions select restrained colored finishes about30% of the time. Canvas compatibility uses stylized tinted facets and does not claim physical transmission.

Cumulative registrations never reset. Old records are represented by exact-count archive bundles, excluding active instances. Detailed instances, recent descriptors and bundle rendering remain bounded. This provides increasing density and archived totals without unbounded RAM or scene-object growth. New forms are copies and transformations of the five real sources, not newly generated AI assets.

## Shallow reflection ground

The global matte-colored plane is replaced with a real planar reflection of the live scene using the official [Three.js Reflector](https://threejs.org/docs/pages/Reflector.html). The original sculpture pedestals remain unchanged. Reflected background pixels become transparent and the plane fades at its edges, removing the opaque color plate. Reflection strength is subtle; no environment map is misrepresented as a reflection of the models.

The target is capped at512×512 desktop or256×256 phone with no multisampling, and captures are throttled. The reflector hides itself during capture, so it cannot recursively reflect itself. No reflected copy is added to R/E/L/F counts or history. Canvas compatibility does not pretend to render this GPU reflection and contains no global floor plate.

## Explicit compatibility path

If WebGL2 is unavailable, initialization fails or the context is lost, the same autonomous process continues in a clearly labeled Canvas line-drawing compatibility mode. It is not presented as the realistic PBR result. The fallback retains the larger initial population, exact structural counts, optional controls and bounded archive.

## Viewing and accessibility

The camera moves automatically. One-finger/mouse drag rotates naturally; two fingers pan and pinch; right mouse drag pans; the wheel zooms. These controls change observation, never the processing rule. After2.4 seconds without inspection, manual offsets blend smoothly back into the automatic path. The automatic camera travels through the occupied model group and looks ahead along its route. It adapts to current instance placement with conservative clearance, using a small near plane for interior views. This is bounding-volume guidance, not triangle-level collision detection. Its base view freezes during inspection and resumes with a smooth blend.

Pause stops the process and automatic view but leaves manual inspection available. Tap a visible surviving form to scatter and gather only that instance's current vertices and source curves. Enter activates it at a central visible curve. A hit-local impulse starts within the next drawing frame and returns within0.82 seconds; all instance poses and every unselected model stay unchanged. At most two independently selected targets can respond at once, and repeat taps cannot reset an active wave. The regular shared source buffers remain immutable. Temporary target-owned position, normal and index buffers follow the current quantization stage and are disposed when the response ends. Logically erased geometry cannot be selected or restored. User-triggered responses finish even while processing is paused; reduced motion replaces deformation with a soft0.22-second local color fade.

Picking uses submitted curves/triangles, not whole registration boxes. The PBR path additionally raycasts actual current mesh patches with per-instance morph weights, including the deformed temporary geometry. Empty space and erased records do nothing.

Thin cyan and magenta fringes briefly follow the selected model’s current curves as the local impulse propagates. The layer is limited to80 source segments per responding instance and contains no particles.

Visible point marks and their animation/GPU resources are removed. There is no P counter. All cast and received shadow maps are disabled; environment lighting, physical material response and the shallow planar mirror remain.

Keyboard arrows rotate, Shift+arrows pan, +/− zoom, Home resets and Space pauses. Reduced-motion preference begins paused and suppresses automatic flight even if processing is manually resumed. Hidden tabs suspend execution without skipping unseen time. The visible control cluster and modal have been removed; Space pauses and Home resets the view.

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
