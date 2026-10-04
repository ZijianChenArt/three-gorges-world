import { BufferAttribute, BufferGeometry } from 'three';
import { hash, smooth } from './archive.js';

export const PATCH_COUNT = 3;
const TAU = Math.PI * 2;
const prepared = new WeakMap();

/** Three source-local angular sectors. Always classify the original point,
 * never its quantized/morphed position. Faces use centroids, edges midpoints.
 */
export function patchIndex(point) {
  // Canonicalize signed zero so equivalent points agree at the angular seam.
  const x = (point?.x ?? point?.[0]) || 0;
  const z = (point?.z ?? point?.[2]) || 0;
  return Math.min(PATCH_COUNT - 1, Math.floor((Math.atan2(z, x) + Math.PI) / TAU * PATCH_COUNT));
}

/** One-time source partition, indexed [stage][patch]. These are index-only
 * views: all vertex attributes, absolute next morph targets and conservative
 * bounds are the original immutable objects. No vertices/faces are invented.
 * Empty subsets stay empty, including all three subsets of the final stage.
 */
export function prepareSurfacePatches(source) {
  if (prepared.has(source)) return prepared.get(source);
  if (!source?.stages?.length || source.stages.length !== source.stageGeometries?.length) {
    throw new Error('Surface patches require full source stages and geometries.');
  }
  const original = source.stages[0].positions;
  const membership = new Uint8Array(original.length / 9);
  const centroid = [0, 0, 0];
  for (let triangle = 0; triangle < membership.length; triangle++) {
    const at = triangle * 9;
    for (let axis = 0; axis < 3; axis++) {
      centroid[axis] = (original[at + axis] + original[at + 3 + axis] + original[at + 6 + axis]) / 3;
    }
    membership[triangle] = patchIndex(centroid);
  }
  const result = Object.freeze(source.stages.map((stage, stageIndex) => {
    const base = source.stageGeometries[stageIndex];
    if (!base.index || base.index.count !== stage.triangleIds.length * 3) {
      throw new Error('Source survivor indices must match their triangle IDs.');
    }
    const triangleIds = Array.from({ length: PATCH_COUNT }, () => []);
    const indices = Array.from({ length: PATCH_COUNT }, () => []);
    for (let survivor = 0; survivor < stage.triangleIds.length; survivor++) {
      const triangle = stage.triangleIds[survivor];
      const patch = membership[triangle];
      triangleIds[patch].push(triangle);
      for (let corner = 0; corner < 3; corner++) indices[patch].push(base.index.getX(survivor * 3 + corner));
    }
    return Object.freeze(indices.map((values, patch) => {
      const geometry = new BufferGeometry();
      geometry.name = `${source.id}:stage:${stageIndex}:patch:${patch}`;
      // Includes the same source UV field; spatial patches cannot create seams.
      for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute);
      geometry.setIndex(new BufferAttribute(new base.index.array.constructor(values), 1));
      geometry.morphAttributes = base.morphAttributes;
      geometry.morphTargetsRelative = base.morphTargetsRelative;
      geometry.boundingBox = base.boundingBox;
      geometry.boundingSphere = base.boundingSphere;
      geometry.userData = {
        stage: stageIndex, patchIndex: patch,
        triangleCount: triangleIds[patch].length,
        triangleIds: Uint32Array.from(triangleIds[patch]),
      };
      return geometry;
    }));
  }));
  prepared.set(source, result);
  return result;
}

/** Slow complementary point -> line -> surface weights in seconds. Adjacent
 * patches are exactly a third-cycle apart, so every instance always retains
 * some of each representation instead of flashing its whole geometry at once.
 * A one-time, smooth surface-led opening keeps the five originals legible.
 */
export function phaseInfo(key, patch, elapsed, { reducedMotion = false } = {}) {
  const seed = hash(Number(key) >>> 0);
  const period = 18 + (hash(seed ^ 0x3c6ef372) / 4294967296) * 8;
  if (reducedMotion) return { surfaceAlpha: 1, lineAlpha: 0, pointAlpha: 0, curvature: 0, phase: 0, period };
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const sector = Number.isFinite(patch) ? ((Math.floor(patch) % PATCH_COUNT) + PATCH_COUNT) % PATCH_COUNT : 0;
  const phase = (time / period + seed / 4294967296 + sector / PATCH_COUNT) % 1;
  const position = phase * PATCH_COUNT;
  const segment = Math.floor(position);
  const blend = smooth(position - segment);
  // Point, line, surface. Smoothstep has zero slope at each cyclic join.
  const weights = [0, 0, 0];
  weights[segment] = 1 - blend;
  weights[(segment + 1) % PATCH_COUNT] = blend;
  const introDuration = 4.2 + (hash(seed ^ 0xa54ff53a) / 4294967296) * 2;
  const opening = .72 * (1 - smooth(time / introDuration));
  const pointAlpha = weights[0] * (1 - opening);
  const lineAlpha = weights[1] * (1 - opening);
  const surfaceAlpha = opening + weights[2] * (1 - opening);
  const curvature = .18 + .68 * lineAlpha + .14 * pointAlpha;
  return { surfaceAlpha, lineAlpha, pointAlpha, curvature, phase, period };
}
