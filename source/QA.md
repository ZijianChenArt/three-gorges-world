# Release validation — 5.2.0

105 automated tests pass, followed by the production Vite build.

## New point / line / surface checks

- Actual surviving source edges produce visibly curved, splitting polylines and associated endpoint/gap points. Fixed-camera coordinates change within five seconds, without changing logical topology or relying on camera motion.
- Exact GLB face partitions are disjoint at all stages and preserve the complete original surviving union. They reuse original immutable attributes and morph targets.
- Local complementary phases are continuous, deterministic and slow; reduced motion is static. Empty stages produce zero submitted faces, lines and points.
- Real Three.js LineSegments and Points buffers are bounded, update from shared source-derived world positions, and report exact submitted counts.
- Renderer integration tests exercise physical patch batches, morphs, ripple poses and the empty endpoint. E remains the logical edge count, separately from subdivided L and displayed P/F.
- The visible title/concept prose is removed; icon controls retain accessible labels and parameter help stays selectable.

## Retained flight and ripple checks

- Perspective camera and Canvas annotations match numerically, including off-axis pan. World-space target and eye translate continuously, with real depth parallax and dolly movement.
- Reference model displacement is about147px desktop and80px phone after five seconds. An hour-long trajectory stays bounded and smooth.
- Natural horizontal/vertical inspection is checked in both orthographic and perspective projections.
- Ripple propagation, smooth return, four-wave cap, paused responses, reduced-motion suppression, cancelled touches and actual PBR matrix displacement are tested. No edge or triangle counts change because of a ripple, and zero-geometry records cannot be picked or resurrected.
- Desktop and phone Canvas render proofs were inspected at0,5,10,25 and50 seconds; these are explicitly compatibility renders, not GPU screenshots.
- The surrounding title and counter strip are reduced; source IDs and spatial connections remain.

## Verified in code and actual-asset tests

- Every one of the28,384 original GLB triangles from29 mesh parts is preserved initially, with no hulls, invented caps or face sampling in the PBR path.
- Full-GLB normalization agrees with the structural-edge coordinates. Nested transforms, including reflections, preserve correct winding and normals.
- Previous-stage double-precision quantization avoids Float32 half-grid drift. Surviving face indices decline monotonically, and all five sources end with zero faces.
- One GPU morph target per transition shares immutable position/normal attributes across instances. Per-instance morph weights and matrices are independent.
- Actual render-bucket tests exercise full GLB stage selection, instanced counts, retirement and the zero-rendered-mesh endpoint without claiming GPU execution.
- Physical metal/roughness/transmission/IOR/thickness properties are tested. The PBR camera numerically matches the registry-overlay projection, including manual camera offsets.
-12 desktop /8 phone initial instances, higher adaptive budgets, faster continuous intake, truthful current/closed/total accounting and bounded24-hour state are tested.
- Existing optional gestures, natural drag directions, cancellation, reduced motion, pause and scoped iOS callout behavior retain coverage.
- Six viewport projections keep labels on screen. Canvas fallback remains explicitly identified.

A local preparation benchmark constructed all shared full-mesh stages in approximately225ms, with13.85MiB of unique typed geometry/index buffers. This excludes driver allocations, environment/shadow/transmission buffers, shader compilation and GPU rendering; it is not a phone performance claim.

## Verification limits

The available cloud browser has no usable WebGL2 GPU renderer. Therefore the real PBR appearance, shader execution, physical glass rendering, shadow quality and GPU frame rate have NOT been visually verified on hardware. Published-browser QA validates the compatibility path and normal UI/process behavior only. Tests of Three.js objects and shader configuration are not presented as rendered GPU evidence.

Physical iOS callout behavior and real multi-touch have not been tested. No GPU restrictions, local-preview blocks or browser security controls were bypassed.
