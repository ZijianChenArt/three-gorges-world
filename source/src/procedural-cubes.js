import {BoxGeometry, EdgesGeometry} from 'three';
import {extractSourceGeometries, prepareSourceStages} from './mesh-source.js';

export const CUBE_SOURCE_ID = 'procedural-cube';
export const CUBE_SOURCE_INDEX = 5;

/** One shared, real cube source, generated at runtime. Original source payloads
 * are never mutated. Archive coordinates use a grounded Y range; normalization
 * restores the actual BoxGeometry(2, 2, 2) coordinates, centered at the origin.
 */
export function withProceduralCubes(wireData, faceData) {
  if (wireData.groups.some(group => group.id === CUBE_SOURCE_ID)) return {wireData, faceData};
  const geometry = new BoxGeometry(2, 2, 2);
  const edges = new EdgesGeometry(geometry);
  const triangles = geometry.toNonIndexed();
  const grounded = array => Array.from(array, (value, index) => value + (index % 3 === 1 ? 1 : 0));
  const group = {
    id: CUBE_SOURCE_ID, name: 'WHITE CUBE', procedural: 'cube',
    bounds: {min: [-1, 0, -1], max: [1, 2, 1]},
    center: [0, 0, 0], edges: grounded(edges.attributes.position.array),
  };
  const faceGroup = {id: CUBE_SOURCE_ID, name: 'WHITE CUBE', triangles: grounded(triangles.attributes.position.array)};
  geometry.dispose(); edges.dispose(); triangles.dispose();
  return {
    wireData: {...wireData, groups: [...wireData.groups, group]},
    faceData: {...faceData, groups: [...faceData.groups, faceGroup]},
  };
}

/** Twelve triangles, six planar faces and twelve true boundary edges. Per-face
 * BoxGeometry UVs are preserved through quantization, patches and local ripples.
 */
export function prepareCubeSource(index = CUBE_SOURCE_INDEX) {
  const box = new BoxGeometry(2, 2, 2);
  const geometry = box.toNonIndexed();
  const prepared = prepareSourceStages(CUBE_SOURCE_ID,
    new Float64Array(geometry.attributes.position.array),
    new Float32Array(geometry.attributes.normal.array), geometry.attributes.uv.clone());
  box.dispose(); geometry.dispose();
  return Object.freeze({
    id: CUBE_SOURCE_ID, name: 'WHITE CUBE', index, procedural: 'cube',
    sourceGroup: null, sourceMeshes: 1, unit: 1, halfY: 1,
    bounds: Object.freeze([1, 1, 1]),
    parts: Object.freeze([Object.freeze({name: CUBE_SOURCE_ID, firstTriangle: 0, triangleCount: 12})]),
    ...prepared,
  });
}

/** Only the five original entries enter the GLB extractor. The procedural
 * source is appended once in the same sixth slot used by the archive model.
 */
export function prepareRuntimeSources(scene, wireData) {
  const sources = extractSourceGeometries(scene, {...wireData, groups: wireData.groups.filter(group => group.id !== CUBE_SOURCE_ID)});
  const cubeIndex = wireData.groups.findIndex(group => group.id === CUBE_SOURCE_ID);
  if (cubeIndex >= 0) sources.splice(cubeIndex, 0, prepareCubeSource(cubeIndex));
  return sources;
}
