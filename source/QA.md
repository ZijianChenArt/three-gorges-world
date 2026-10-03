# Browser verification for independent dispersal

1. Open without touching the canvas. Five recognizable original sculptures appear. One begins shedding individual edges within ten seconds while others wait.
2. Watch several moments rather than looking for a synchronized loop. Different sculptures should occupy different states, with distinct dispersal directions and ranges.
3. Confirm both short detached strokes and endpoint dots are visible. Fully dispersed portions should be sparse, with open space and slow continuous motion rather than random frame-to-frame flicker.
4. Continue until original forms return at different times. Each form must reappear intact; it should not get permanently lost in a particle field.
5. Reload. The new visit receives different timing and field choices, with the same five originals.
6. Pause/Play while partly dispersed. Pause holds the current composition; resume is continuous.
7. Open About and close using its button, Return, Escape and outside backdrop. Focus returns to the opener and the score does not jump.
8. Switch tabs and return. Hidden time is not included. Reduced-motion preference must begin on a fully formed still image.
9. Check portrait phone, tablet, desktop and landscape sizes. Geometry and controls remain inside the visible area, including during wide dispersal.
10. Check site-origin console errors. Canvas2D must work without WebGL, audio, external services, pointer gestures or permission prompts.

Automated tests cover seeded reproducibility, variation across seeds and lifecycles, independent timing, individual edge delays, exact model re-formation, continuous lifecycle boundaries, sparse mark budgets, finite/bounded geometry and six responsive sizes. Render proofs do not replace physical-device testing.

## Rich layers and optional gesture regression checks

- Inspect contour peeling, curved filament trails, orbital endpoint families and faint structural echoes at multiple phases. Each remains bounded and low-contrast.
- Drag a model area: the whole 3D view rotates, without a tap ripple or accidental hold. Wheel zoom and Reset View work.
- Tap visible wire geometry: a local ripple appears and responds under the current camera projection.
- Long-press: gather only the selected model; release smoothly. Move after a hold to switch to orbit without leaving gathering active.
- Two-pointer sequences: pan/pinch; second pointer cancels a hold; lifting a finger never triggers a spurious tap. Unit tests cover these sequences; physical multi-touch remains a separate device check.
- While automatic motion is paused, rotate/zoom and gather/release with the keyboard. Escape cancels.
- Verify computed canvas callout/selection/touch-action suppression while About retains text selection. A physical iOS check is still needed to verify the native callout on an actual device.
