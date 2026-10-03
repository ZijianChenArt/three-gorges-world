# Release validation — 4.0.0

## Automated checks

35 tests passed, followed by the production Vite build.

- Five source groups and all 5,789 initial edges preserved.
- Quantization moves real coordinates; no opacity-based substitute.
- Surviving edge topology decreases monotonically and ends at zero.
- Actual edge arrays drive displayed counts.
- All source-triangle facets are degenerate at the empty endpoint.
- Empty records persist, new instances register separately, and cumulative counts match their serials.
- Long-running topology and history are bounded.
- Automatic camera is continuous; each intake has repeatable, varying transforms.
- Rightward and upward dragging move a front-side point in the corresponding screen direction.
- Optional mouse/touch arbitration, cancellation, bounded camera and reset tested.
- Label visibility checked across 320×568, 390×844, 768×1024, 1188×762, 1440×1000 and 844×390.
- Pause, reduced-motion, hidden-tab/dialog suspension and scoped iOS callout CSS checked.

## Visual and runtime validation

Actual renderer output inspected at the source, intermediate reduction and empty-record stages, on desktop and portrait-phone projections. Original holes are preserved; solid facets are actual source triangles. Near-empty frames retain their fixed registration volumes rather than shrinking the composition to fit.

A local Node benchmark averaged approximately 4.9 ms per frame for geometry and draw-call preparation. This excludes browser rasterization and is not a physical-phone performance claim.

The published GitHub Pages build is the supported browser QA route. Physical iOS native callout behavior and physical multi-touch have not been tested; pointer arbitration and CSS scoping have automated coverage. No local-preview security restrictions were bypassed.
