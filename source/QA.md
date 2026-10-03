# Browser verification

Run the production build over HTTP or the published GitHub Pages URL. Tests using mocked Canvas2D verify pure rendering behavior but do not substitute for browser/device checks.

1. Desktop and portrait phone: all five original sculptures appear; no WebGL requirement, overflow, clipped controls or missing assets.
2. Hover or focus a sculpture; hold it. The held state and on-canvas frame appear immediately. Other sculptures continue migrating.
3. Drag and release. The sculpture stays relocated, the ground deforms, and its previous geometry remains faintly visible. Release does not snap it back.
4. Cancel a pointer or leave the tab while holding. It must release safely. Repeated dragging must remain possible.
5. Focus the canvas with the keyboard. Arrows choose a sculpture; Space holds; arrows move; Space releases. Escape also releases. R resets.
6. Pause time, wait, then manipulate a sculpture. The clock stays still; manipulation remains available. Resume time.
7. Open Rules, close with its button, Escape, and the outside backdrop. Focus returns to the opener. No time jump occurs.
8. Sound starts off; explicit activation turns it on. Turning off silences it. No microphone permission is used.
9. Reduced motion: load with the preference enabled. Time starts paused while the artwork remains interactive.
10. Allow the 140-second score to settle. It remains visible and interactive with the state label “残余 / REMAINDER”. It never resets automatically.
11. Reset after interacting and after settling; clear all traces and restore initial composition. Repeat.
12. Check browser console for exceptions and asset/network failures. State and interaction remain entirely in the page.
