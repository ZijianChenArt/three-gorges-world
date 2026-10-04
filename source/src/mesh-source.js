import { BufferAttribute, BufferGeometry, Matrix3, Vector3 } from 'three';
import { STEPS } from './archive.js';

// One-time GLB preparation. Returned attributes are read-only shared assets:
// instances change only their geometry reference and one morph influence.
const POSITION_PRECISION = 1e6;
const sourcePoint = new Vector3();
const sourceNormal = new Vector3();
const normalMatrix = new Matrix3();

function allTriangleIds(count) {
  return Uint32Array.from({ length: count }, (_, index) => index);
}

/** Remove collapsed and coincident faces, considering only prior survivors.
 * Integer position keys match archive.compactEdges. Every nonzero quantization
 * grid is much coarser than the one-millionth-unit comparison tolerance.
 */
export function compactTriangleIds(positions, candidates) {
  const surviving = [];
  const seen = new Set();
  for (const triangle of candidates) {
    const at = triangle * 9;
    const a = [], b = [], c = [];
    for (let axis = 0; axis < 3; axis++) {
      a.push(Math.round(positions[at + axis] * POSITION_PRECISION));
      b.push(Math.round(positions[at + 3 + axis] * POSITION_PRECISION));
      c.push(Math.round(positions[at + 6 + axis] * POSITION_PRECISION));
    }
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    if (uy * vz === uz * vy && uz * vx === ux * vz && ux * vy === uy * vx) continue;
    const key = [a.join(','), b.join(','), c.join(',')].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    surviving.push(triangle);
  }
  return Uint32Array.from(surviving);
}

function triangleIndex(triangles, vertexCount) {
  const ArrayType = vertexCount > 65535 ? Uint32Array : Uint16Array;
  const indices = new ArrayType(triangles.length * 3);
  for (let index = 0; index < triangles.length; index++) {
    const vertex = triangles[index] * 3;
    indices[index * 3] = vertex;
    indices[index * 3 + 1] = vertex + 1;
    indices[index * 3 + 2] = vertex + 2;
  }
  return new BufferAttribute(indices, 1);
}

function quantizedPositions(previous, step) {
  if (!Number.isFinite(step) || step <= 0) throw new Error('Quantization steps must be finite and positive.');
  // Keep CPU quantization in double precision. Feeding Float32 GPU values
  // back into the next grid changes half-grid rounding (e.g. .065 / .13).
  const positions = new Float64Array(previous.length);
  for (let index = 0; index < previous.length; index++) {
    const value = Math.round(previous[index] / step) * step;
    positions[index] = Math.abs(value) < 1e-9 ? 0 : value;
  }
  return positions;
}

/** Facet normals for snapped surfaces; a collapsed face retains its previous
 * normal so even zero-area targets never send NaN/zero normals to the GPU.
 */
function facetNormals(positions, previous) {
  const normals = new Float32Array(positions.length);
  for (let at = 0; at < positions.length; at += 9) {
    const ux = positions[at + 3] - positions[at];
    const uy = positions[at + 4] - positions[at + 1];
    const uz = positions[at + 5] - positions[at + 2];
    const vx = positions[at + 6] - positions[at];
    const vy = positions[at + 7] - positions[at + 1];
    const vz = positions[at + 8] - positions[at + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    const length = Math.hypot(x, y, z);
    if (length > 1e-8) {
      for (let corner = 0; corner < 3; corner++) {
        normals[at + corner * 3] = x / length;
        normals[at + corner * 3 + 1] = y / length;
        normals[at + corner * 3 + 2] = z / length;
      }
    } else {
      for (let corner = 0; corner < 3; corner++) {
        const offset = at + corner * 3;
        const px = previous?.[offset] || 0;
        const py = previous?.[offset + 1] || 0;
        const pz = previous?.[offset + 2] || 0;
        const previousLength = Math.hypot(px, py, pz);
        normals[offset] = previousLength ? px / previousLength : 0;
        normals[offset + 1] = previousLength ? py / previousLength : 1;
        normals[offset + 2] = previousLength ? pz / previousLength : 0;
      }
    }
  }
  return normals;
}

/** Prepare one normalized triangle source once, preserving its source UVs.
 * The real GLB sources and the runtime cube share this exact reduction path.
 */
export function prepareSourceStages(id, precisePositions, normals, uvAttribute, { steps = STEPS } = {}) {
  const vertexCount = precisePositions.length / 3;
  if (!Number.isInteger(vertexCount) || vertexCount % 3 || !vertexCount) throw new Error('A normalized triangle source is required.');
  const positions = new Float32Array(precisePositions);
  const sourceTriangles = vertexCount / 3;
  const stages = [{ positions, normals, triangleIds: allTriangleIds(sourceTriangles), triangleCount: sourceTriangles, step: 0 }];
  let priorCoordinates = precisePositions;
  for (const step of steps) {
    const previous = stages.at(-1);
    priorCoordinates = quantizedPositions(priorCoordinates, step);
    const positions = new Float32Array(priorCoordinates);
    const triangleIds = compactTriangleIds(positions, previous.triangleIds);
    stages.push({ positions, normals: facetNormals(positions, previous.normals), triangleIds, triangleCount: triangleIds.length, step });
  }
  const attributes = stages.map(stage => ({
    position: new BufferAttribute(stage.positions, 3),
    normal: new BufferAttribute(stage.normals, 3),
  }));
  const stageGeometries = stages.map((stage, stageIndex) => {
    const geometry = new BufferGeometry();
    geometry.name = `${id}:stage:${stageIndex}`;
    geometry.setAttribute('position', attributes[stageIndex].position);
    geometry.setAttribute('normal', attributes[stageIndex].normal);
    geometry.setAttribute('uv', uvAttribute);
    geometry.setIndex(triangleIndex(stage.triangleIds, vertexCount));
    const next = attributes[Math.min(stageIndex + 1, stages.length - 1)];
    geometry.morphAttributes.position = [next.position];
    geometry.morphAttributes.normal = [next.normal];
    geometry.morphTargetsRelative = false;
    // Attribute names are stable across geometry switches, so each mesh keeps
    // its own one-element influence array for its complete lifetime.
    next.position.name = 'next';
    next.normal.name = 'next';
    geometry.userData.triangleCount = stage.triangleCount;
    geometry.userData.stage = stageIndex;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  });
  return {
    sourceTriangles, geometry: stageGeometries[0], stageGeometries: Object.freeze(stageGeometries),
    stages: Object.freeze(stages.map(Object.freeze)),
    triangleCounts: Object.freeze(stages.map(stage => stage.triangleCount)),
  };
}

function validateWireData(data) {
  if (!Array.isArray(data?.groups) || !Array.isArray(data.sceneOriginOriginal)
      || data.sceneOriginOriginal.length !== 3 || !data.sceneOriginOriginal.every(Number.isFinite)
      || !Number.isFinite(data.sceneScale) || data.sceneScale <= 0) {
    throw new Error('Full sculpture-wireframes.json normalization metadata is required.');
  }
}

/** Extract every original GLB triangle, including apertures and separate parts.
 * No hull, cap, sampling, remeshing, source-material mutation, or GLB edit occurs.
 *
 * @param {import('three').Object3D} scene Loaded GLTFLoader gltf.scene.
 * @param {object} wireData Complete sculpture-wireframes.json payload.
 * @param {{steps?: number[]}} options Defaults to the archive's six steps.
 * @returns {Array<object>} Sources in wireData.groups / prepareArchive order.
 *
 * source.stages[k]: { positions, normals, triangleIds, triangleCount, step }
 * source.stageGeometries[k]: immutable survivor index, stage k attributes,
 *   and ONE absolute next-stage position/normal target (named "next").
 * Adjacent stages share BufferAttributes. Per-stage morph textures therefore
 * contain one target, rather than duplicating all six targets seven times.
 */
export function extractSourceGeometries(scene, wireData, { steps = STEPS } = {}) {
  validateWireData(wireData);
  if (!scene?.isObject3D) throw new Error('A loaded glTF scene is required.');
  scene.updateWorldMatrix(true, true);
  return wireData.groups.map((group, index) => {
    const root = scene.getObjectByName(group.sourceGroup);
    if (!root) throw new Error(`Missing original GLB group: ${group.sourceGroup}`);
    const size = group.bounds.max.map((value, axis) => value - group.bounds.min[axis]);
    const unit = Math.max(...size) / 2, halfY = size[1] / 2;
    if (!Number.isFinite(unit) || unit <= 0 || !group.center.every(Number.isFinite)) {
      throw new Error(`Invalid source bounds: ${group.id}`);
    }
    const meshes = [];
    let vertexCount = 0;
    root.traverse(object => {
      if (!object.isMesh) return;
      if (object.isSkinnedMesh || object.isInstancedMesh) {
        throw new Error(`Unsupported animated/instanced source mesh: ${object.name}`);
      }
      const geometry = object.geometry;
      const count = geometry.index?.count ?? geometry.getAttribute('position')?.count;
      if (!Number.isInteger(count) || count % 3) throw new Error(`Invalid source triangles: ${object.name}`);
      meshes.push(object);
      vertexCount += count;
    });
    if (!vertexCount) throw new Error(`Empty original GLB group: ${group.sourceGroup}`);
    const precisePositions = new Float64Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const parts = [];
    let output = 0;
    for (const mesh of meshes) {
      const input = mesh.geometry.getAttribute('position');
      const inputNormals = mesh.geometry.getAttribute('normal');
      const indices = mesh.geometry.index;
      const count = indices?.count ?? input.count;
      const flipped = mesh.matrixWorld.determinant() < 0;
      normalMatrix.getNormalMatrix(mesh.matrixWorld);
      const firstTriangle = output / 9;
      for (let face = 0; face < count; face += 3) {
        for (let corner = 0; corner < 3; corner++) {
          // Baking a reflected world matrix must preserve outward winding.
          const cornerAt = flipped && corner > 0 ? 3 - corner : corner;
          const sourceIndex = indices ? indices.getX(face + cornerAt) : face + cornerAt;
          sourcePoint.fromBufferAttribute(input, sourceIndex).applyMatrix4(mesh.matrixWorld);
          for (let axis = 0; axis < 3; axis++) {
            const normalized = (sourcePoint.getComponent(axis) - wireData.sceneOriginOriginal[axis])
              * wireData.sceneScale - group.center[axis];
            const value = (normalized - (axis === 1 ? halfY : 0)) / unit;
            if (!Number.isFinite(value)) throw new Error(`Nonfinite source coordinate: ${group.id}`);
            precisePositions[output + axis] = value;
          }
          if (inputNormals) {
            sourceNormal.fromBufferAttribute(inputNormals, sourceIndex).applyNormalMatrix(normalMatrix);
            normals[output] = sourceNormal.x;
            normals[output + 1] = sourceNormal.y;
            normals[output + 2] = sourceNormal.z;
          }
          output += 3;
        }
      }
      parts.push(Object.freeze({ name: mesh.name, firstTriangle, triangleCount: count / 3 }));
    }
    // Preserve original smooth/flat normals, filling only genuinely absent ones.
    const positions = new Float32Array(precisePositions);
    // A continuous original-source planar coordinate field, shared by every
    // stage. Snapping, patching and ripples never resample or animate the map.
    const uv = new Float32Array(vertexCount * 2);
    for (let vertex = 0; vertex < vertexCount; vertex++) for (let axis = 0; axis < 2; axis++) {
      const span = size[axis] / unit;
      uv[vertex * 2 + axis] = span > 0
        ? Math.max(0, Math.min(1, positions[vertex * 3 + axis] / span + .5)) : .5;
    }
    const uvAttribute = new BufferAttribute(uv, 2);
    const fallback = facetNormals(positions);
    for (let at = 0; at < normals.length; at += 3) {
      if (!Number.isFinite(normals[at] + normals[at + 1] + normals[at + 2])
          || Math.hypot(normals[at], normals[at + 1], normals[at + 2]) < 1e-8) {
        normals[at] = fallback[at];
        normals[at + 1] = fallback[at + 1];
        normals[at + 2] = fallback[at + 2];
      }
    }
    const prepared = prepareSourceStages(group.id, precisePositions, normals, uvAttribute, { steps });
    return Object.freeze({
      id: group.id, name: group.name, index, sourceGroup: group.sourceGroup,
      sourceMeshes: meshes.length, parts: Object.freeze(parts),
      unit, halfY, bounds: Object.freeze(size.map(value => value / unit / 2)),
      ...prepared,
    });
  });
}

/** Update one instance with no CPU vertex rebuild or per-frame buffer upload.
 * Returns the number of submitted surviving triangles. At a completed commit
 * the next shared index is selected immediately; the final mesh is invisible.
 */
export function applyMeshStage(mesh, source, stage = 0, blend = 0) {
  const finalStage = source.stageGeometries.length - 1;
  let current = Math.max(0, Math.min(finalStage, Number.isFinite(stage) ? Math.floor(stage) : 0));
  let influence = Math.max(0, Math.min(1, Number.isFinite(blend) ? blend : 0));
  if (influence === 1 && current < finalStage) { current++; influence = 0; }
  if (current === finalStage) influence = 0;
  mesh.geometry = source.stageGeometries[current];
  if (!mesh.morphTargetInfluences || mesh.morphTargetInfluences.length !== 1) mesh.updateMorphTargets();
  mesh.morphTargetInfluences[0] = influence;
  mesh.visible = source.triangleCounts[current] > 0;
  return source.triangleCounts[current];
}

export const prepareMeshSources = extractSourceGeometries;
