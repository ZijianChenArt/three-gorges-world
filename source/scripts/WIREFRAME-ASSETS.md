# Rebuilding the sculpture wireframes

Run from the app directory:

```sh
python3 -m pip install numpy scipy
python3 scripts/extract-wireframes.py
```

The converter reads `public/models/three-gorges.glb` and writes
`public/models/sculpture-wireframes.json`. Despite the inherited GLB filename,
the asset contains the five original media-art sculptures, not a dam model.
The GLB is never changed. A conversion/test summary is saved beside the script
as `wireframe-extraction-report.json`.

## JSON contract

- `coordinateSystem`: right-handed glTF, Y up.
- The full scene is uniformly scaled to a longest dimension of 22.
- `sceneOriginOriginal` and `sceneScale` define the original-to-normalized
  conversion: `(originalPoint - sceneOriginOriginal) * sceneScale`.
- Each group is centered at its bounding box's bottom-center: X/Z midpoint,
  minimum Y. Its `center` and `bounds` are in normalized scene coordinates.
- `edges` is a flat array of six numbers per segment:
  `[ax, ay, az, bx, by, bz, ...]`. Points are local to the group's bottom-center.
  Add `group.center` to recover the normalized original scene arrangement.
- `edgeCount` is `edges.length / 6`. `id`, `name` and `sourceGroup` preserve the
  five original sculpture identities.
- `sourceSHA256` identifies the exact GLB that produced the asset.

## Extraction and mobile budget

The converter applies glTF node transforms, welds coincident positions, and
keeps boundaries and creases of at least 18 degrees. Coplanar triangulation
diagonals and smooth-surface tessellation are omitted. Nonbranching chains are
simplified with 3D Ramer-Douglas-Peucker. For extraction tolerances only, each
group uses a temporary longest extent of 2: minimum retained length 0.005 and
chain tolerance 0.0075. The final coordinates use the common scene scale.

The voxel cloud additionally merges tiny bevel-corner clusters within 0.014
in that temporary coordinate system. This removes microscopic rounded-corner
detail and wire thickness while preserving the cloud's arrangement and voxel
orientations. No replacement geometry is invented.

Current result: 5,789 segments across five groups, each below 1,500 segments.
The compact JSON is approximately 285 KB, or 50 KB with gzip.

The renderer can apply its own interactive placement, rotation, or distortion
to these local coordinates without loading WebGL or parsing the GLB at runtime.

Verified with Python 3, NumPy 2.3.5 and SciPy 1.17.0. The converter asserts the
five-group count, per-group segment budget, finite/nonzero segments, bounds
containment and normalized extent before writing.

## Sparse original face accents

```sh
python3 scripts/extract-faces.py
```

This reads the unchanged GLB plus wireframe normalization metadata and creates
`public/models/sculpture-faces.json`. Each group has the same ID, bottom-center,
scale and bounds, with a flat `triangles` buffer containing nine coordinates per
triangle and `faceCount: 400`. Add the group center exactly as for wire edges.

The 2,000 triangles are deterministic samples of actual original GLB triangles,
weighted toward larger areas and balanced across original material mesh parts.
They are sparse accents, not a complete surface approximation. The converter
never makes convex hulls, fills holes, invents caps, merges face triangles, or
changes the original GLB or wireframe asset. Its output is about 148 KB raw or
33 KB gzip. `face-extraction-report.json` records counts and validation results.

The Data Cloud's earlier wire asset simplifies microscopic bevel corners;
these face samples retain actual original vertex positions. Most vertices
therefore coincide directly, while a few cloud bevel vertices differ slightly
from simplified edge endpoints. Apply the same display quantization to both.
