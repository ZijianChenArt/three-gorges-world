# Release validation — 5.6.2

210 automated tests pass, followed by the production Vite build.

## This revision

- All procedural cubes are now tiny accents (0.055–0.22 source scale) and have no visible ID labels, leader links, backing rectangles or registration boxes.
- Retired-cube totals stay exact in bounded scalar counters. Visual historical bundles include original sculptures only, without invented serial ranges.
- The opening is intentionally closer and may crop foreground objects. Projection tests no longer require the first composition to fit all models; continuity and readable surviving geometry remain checked.


- One shared procedural cube source participates in actual edge/triangle reduction, registry counts, picking and local response. Initial scenes preserve all five original sources plus five cubes; sizes and admissions are seeded and bounded.
- The opening is closer, labels are lightly gray-backed, selected colors are more saturated, and all ground effects are removed.
- A400ms hold attracts only the selected current geometry and releases smoothly. G is the keyboard equivalent. Repeated same-model taps are accepted immediately with bounded stacked pulses.
- Pointer cancellation, second-finger takeover, focus loss, erased geometry, pause/reduced motion and camera-neutral holds have test coverage.


- HTML/CSS, Canvas clearing, the physical scene all use exact pure white (#FFFFFF); labels use light-gray backing.

- Ground mirror geometry, Reflector import, capture target and reflection hook are removed. The main draw submits one scene render and cleanup has no dangling floor resource. Environment/PBR reflections remain; ground shadows and receiver geometry are also removed.

- Actual source edges now produce one uninterrupted sampled polyline each, with no independent bowing arcs, split gaps, appearance gates, duplicate entry outline or added chromatic fringes. Shared model deformation bends the existing edge samples.
- Full-viewport rendering replaces mismatched top/bottom bands. Six-plane clipping keeps near-plane crossings finite and interpolates source coordinates for accurate picking. The actual triangle budget remains bounded; redundant resize events do not clear the Canvas.
- These are verified code-level flicker risks. The original reported GPU artifact was not reproduced on a real GPU and is not claimed conclusively fixed there.

## Retained camera checks

- Repeated pending touches and taps produce exactly the same complete camera pose and clock as untouched playback in deterministic integration tests.
- Real drag promotion snapshots the displayed camera before applying finger movement. Multi-touch takeover, last release, cancellation, repeated gestures and smooth return are tested without ghost taps.
- Exact pointer-down hit identity and local coordinates are retained while the camera continues moving.
- A continuous macrocycle alternates panoramic orbit, approach, interior weaving and pullout. Tests cover cycle boundaries, wide framing, interior cluster entry and shared Canvas/Three projection.

## Retained checks

- Visible point generation, animation data, point textures, Three.Points objects and their GPU buffers are removed. No P counter or point marks remain. Compatibility fields report zero points.
- No ground shadow map, caster, receiver or mirror remains. Material environment lighting is preserved.
- The camera follows a forward-looking interior route through the model group, guided by current instance centers and conservative bounds. Automatic view freezes during manual inspection and resumes with smooth blending.
- Ten bounded shared material finishes include rough/polished metals, clear/smoked/amber glass, cobalt lacquer, oxide ceramic and two acid gradients. Shared small texture maps and source-local UV continuity are checked. Seeded intake and selective color distribution are checked.
- Each instance has independent slow multi-axis rotation and bounded drift; Canvas/PBR transforms match numerically and pause/reduced motion are covered.
- Hit-local impulses act within33ms, propagate spatially and finish within1.5s. Existing-edge tint shares that envelope; no additional geometry is created. Reduced motion uses a soft stationary color fade.
- Single-model vertex/curve scatter and gather remain isolated. No whole-scene translation or resurrection of erased geometry occurs.

## Automated coverage

The aggregate Node tests and production Vite build must pass against the final source. Coverage includes:

- Zero point output and zero point GPU resources on desktop and phone, during ordinary processing and selected-model response.
- Interior camera position, continuous travel, depth variation, foreground/background parallax, clipping-plane safety and numerical Canvas/Three projection agreement.
- Actual GLB mesh partitions, source integrity, stage quantization, monotonic triangle loss, final zero geometry and truthful structural edge counts.
- Geometry-based picking, target-owned response buffers, exact return at a fixed stage, no changes to other instances, empty-space and deleted-object rejection.
- Pause, reduced motion, natural camera gestures, pointer cancellation, keyboard equivalents and canvas-scoped iOS callout suppression.
- Bounded line buffers, instance budgets, cumulative registrations and compact history across a 24-hour simulation.

## Retained asset and performance checks

All 28,384 original GLB triangles from 29 mesh parts are present at registration. No hulls or invented caps are added. Ordinary instances share immutable stage geometry and physical materials. Detailed instances have a strict 32-instance safety bound; history bundles maintain exact cumulative counts.

A prior CPU-only local preparation benchmark constructed the shared full-mesh stages in approximately 225 ms, with 13.85 MiB of typed geometry/index buffers. On the largest 11,952-triangle source, a selected-model response cost about 4.15 ms median and owned 932,256 bytes of temporary buffers. These exclude GPU work and are not phone performance claims.

## Verification limits

The latest cube/hold/repeated-tap interaction revision was checked with automated tests and offline Canvas renders. Its live browser interaction check remains outstanding.

The available cloud browser has no usable WebGL2 GPU renderer. Real PBR appearance, GPU shader execution, physical glass, GPU frame rate have NOT been visually verified on hardware. Published-browser checks validate the explicitly labeled Canvas compatibility path. Tests of Three.js objects are not presented as GPU-rendered evidence.

The camera uses conservative bounding-volume guidance, not triangle-level collision detection. It can pass through open structural volumes and may cross a changing surface. Physical iOS callout behavior and real multi-touch remain untested. No GPU restrictions or blocked local preview were bypassed.
