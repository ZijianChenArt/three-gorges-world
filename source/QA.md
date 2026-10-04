# Release validation — 5.4.0

144 automated tests pass, followed by the production Vite build.

## This revision

- Visible point generation, animation data, point textures, Three.Points objects and their GPU buffers are removed. No P counter or point marks remain. Compatibility fields report zero points.
- Shadow maps, light casters and mesh receivers are disabled. Physical material illumination and the bounded shallow planar reflection remain.
- The camera follows a forward-looking interior route through the model group, guided by current instance centers and conservative bounds. Automatic view freezes during manual inspection and resumes with smooth blending.
- Eight bounded shared material finishes include rough/polished metals, clear/smoked/amber glass, cobalt lacquer and oxide ceramic. Seeded intake and selective color distribution are checked.
- Each instance has independent slow multi-axis rotation and bounded drift; Canvas/PBR transforms match numerically and pause/reduced motion are covered.
- Hit-local impulses act within33ms, propagate spatially and finish within0.82s. Chromatic curve fringes share that envelope and remain point-free. Reduced motion uses a soft stationary color fade.
- Single-model vertex/curve scatter and gather remain isolated. No whole-scene translation or resurrection of erased geometry occurs.

## Automated coverage

The aggregate Node tests and production Vite build must pass against the final source. Coverage includes:

- Zero point output and zero point GPU resources on desktop and phone, during ordinary processing and selected-model response.
- Interior camera position, continuous travel, depth variation, foreground/background parallax, clipping-plane safety and numerical Canvas/Three projection agreement.
- Actual GLB mesh partitions, source integrity, stage quantization, monotonic triangle loss, final zero geometry and truthful structural edge counts.
- Geometry-based picking, target-owned response buffers, exact return at a fixed stage, no changes to other instances, empty-space and deleted-object rejection.
- Pause, reduced motion, natural camera gestures, pointer cancellation, keyboard equivalents and canvas-scoped iOS callout suppression.
- Bounded line buffers, instance budgets, cumulative registrations and compact history across a 24-hour simulation.
- Bounded actual planar-reflection target, reflected camera, self-exclusion and render-state restoration. The fade shader is statically inspected.

## Retained asset and performance checks

All 28,384 original GLB triangles from 29 mesh parts are present at registration. No hulls or invented caps are added. Ordinary instances share immutable stage geometry and physical materials. Detailed instances have a strict 32-instance safety bound; history bundles maintain exact cumulative counts.

A prior CPU-only local preparation benchmark constructed the shared full-mesh stages in approximately 225 ms, with 13.85 MiB of typed geometry/index buffers. On the largest 11,952-triangle source, a selected-model response cost about 4.15 ms median and owned 932,256 bytes of temporary buffers. These exclude GPU work and are not phone performance claims.

## Verification limits

The available cloud browser has no usable WebGL2 GPU renderer. Real PBR appearance, GPU shader execution, physical glass, planar-reflection appearance and GPU frame rate have NOT been visually verified on hardware. Published-browser checks validate the explicitly labeled Canvas compatibility path. Tests of Three.js objects are not presented as GPU-rendered evidence.

The camera uses conservative bounding-volume guidance, not triangle-level collision detection. It can pass through open structural volumes and may cross a changing surface. Physical iOS callout behavior and real multi-touch remain untested. No GPU restrictions or blocked local preview were bypassed.
