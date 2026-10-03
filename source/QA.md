# Autonomous artwork browser checks

1. Open the production URL without touching the canvas. Confirm five recognizable original sculptures appear and the line field visibly transforms within ten seconds.
2. Watch a whole cycle: layered dissolution, broad common weave, reconstruction of all five models, then continued movement into the next cycle without a blank frame or abrupt reset.
3. Check Pause/Play at both formed and woven phases. Pausing must hold exactly the current composition; resuming must not jump.
4. Open About, then close via its close button, return button, Escape and outside backdrop. Focus returns to the opener; the composition resumes without a time jump.
5. Switch tabs while playing and return. Time does not advance while hidden.
6. With reduced motion enabled, load a fully formed still composition. Play explicitly to start, then pause.
7. Inspect portrait phone, tablet, desktop and landscape framing through formed, intermediate and woven phases; no geometry or controls should be clipped.
8. Check browser console for site-origin exceptions. The app must work without WebGL, external services, pointer input or audio permissions.

Unit checks sample all five source geometries and verify exact reformation, continuity at cycle boundaries, deterministic transformation, finite/bounded positions and automatic framing across six viewport sizes. Pure-render proofs do not replace browser or physical-device testing.
