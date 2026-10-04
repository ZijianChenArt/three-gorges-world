# Release validation — 4.1.0

44 automated tests passed, followed by the production Vite build.

Covered: all five exact source edge sets; real coordinate movement; monotonic per-instance topology loss; all facets degenerate at zero geometry; independent seeded source/material/timing choices; update-subdivision reproducibility; continuous intake and rising density; exact live/closed/total record accounting; exact bundle counts excluding live records; adaptive intake without premature deletion; bounded state through a simulated24 hours; pause and reduced-motion; natural camera drag direction; stable optional gesture arbitration; six viewport projections and readable labels.

Material tests cover four distinct monochrome styles, view-dependent metallic response, view-independent matte shading, low-alpha translucency, hatches clipped to actual projected triangles and source-space inspection bands, invalid input handling and strict hatch budgets. No random samples occur inside frame shading.

Actual renderer proofs were inspected at 0, 20, 50, 120 and300 seconds for desktop and portrait-phone compositions, covering sparse and dense states and the accumulated distant archive. A local Node benchmark averaged approximately8.4 ms/frame for geometry and draw-call preparation across a six-minute sample. It excludes browser rasterization and is not a physical-phone performance claim.

The published GitHub Pages build is used for browser verification. Physical iOS callout behavior and physical multi-touch have not been tested; their pointer arbitration and scoped CSS have automated coverage. No local-preview access restrictions were bypassed.
