import {BufferAttribute, BufferGeometry, Box3, Sphere, DynamicDrawUsage} from 'three';
import {prepareSurfacePatches} from './surface-patches.js';
import {createRippleDeformer, hasRipple, MAX_RIPPLE_DISPLACEMENT} from './ripple.js';

/** Resolve the same current/next transition as the regular instanced path. */
function transition(source, frame) {
  const final = source.stages.length - 1;
  let stage = Math.max(0, Math.min(final, Number.isFinite(frame?.stage) ? Math.floor(frame.stage) : 0));
  let blend = Math.max(0, Math.min(1, Number.isFinite(frame?.blend) ? frame.blend : 0));
  if ((frame?.committed || blend === 1) && stage < final) { stage++; blend = 0; }
  if (stage === final) blend = 0;
  return {stage, next: Math.min(final, stage + 1), blend};
}

/**
 * One active instance's temporary, CPU-interpolated surface geometry.
 *
 * new RippleMesh(source, serial); update(frame, ripples) -> three geometries.
 * Create only for an active serial, replace only that serial's instanced draw,
 * and dispose at expiry. Positions and normals are cloned once, shared among
 * these three patches only, and overwritten from CURRENT source stages each
 * update. Index arrays also belong to the target, so disposal never releases
 * a regular instance's shared GPU index buffer. No morph targets are attached.
 */
export class RippleMesh {
  constructor(source, serial) {
    if (!Number.isSafeInteger(serial) || serial < 0) throw new Error('RippleMesh requires an instance serial.');
    this.source = source;
    this.serial = serial;
    this.patches = prepareSurfacePatches(source);
    this.position = new BufferAttribute(source.stages[0].positions.slice(), 3).setUsage(DynamicDrawUsage);
    this.normal = new BufferAttribute(source.stages[0].normals.slice(), 3).setUsage(DynamicDrawUsage);
    this.outputPoint = [0, 0, 0];
    this.stage = -1;
    this.disposed = false;
    // Conservative bounds cover every possible current/next stage and pulse.
    // They are shared only inside this target, not with immutable source bounds.
    const box = new Box3();
    for (const geometry of source.stageGeometries) box.union(geometry.boundingBox);
    box.expandByScalar(MAX_RIPPLE_DISPLACEMENT);
    const sphere = box.getBoundingSphere(new Sphere());
    this.geometries = this.patches[0].map((patch, patchIndex) => {
      const geometry = new BufferGeometry();
      geometry.name = `${source.id}:ripple:${serial}:patch:${patchIndex}`;
      geometry.setAttribute('position', this.position);
      geometry.setAttribute('normal', this.normal);
      geometry.setIndex(new BufferAttribute(patch.index.array.slice(), 1).setUsage(DynamicDrawUsage));
      geometry.boundingBox = box;
      geometry.boundingSphere = sphere;
      geometry.userData = {serial, patchIndex, stage: 0, triangleCount: 0};
      return geometry;
    });
  }

  update(frame, ripples) {
    if (this.disposed) throw new Error('Cannot update a disposed RippleMesh.');
    const {stage, next, blend} = transition(this.source, frame);
    const current = this.source.stages[stage], destination = this.source.stages[next];
    if (stage !== this.stage) {
      for (let patch = 0; patch < this.geometries.length; patch++) {
        const geometry = this.geometries[patch], original = this.patches[stage][patch];
        // Stage-zero capacity is sufficient forever: survivors only disappear.
        geometry.index.array.set(original.index.array);
        geometry.index.count = original.index.count;
        geometry.index.needsUpdate = true;
        geometry.setDrawRange(0, original.index.count);
        geometry.userData.stage = stage;
        geometry.userData.triangleCount = original.userData.triangleCount;
      }
      this.stage = stage;
    }
    const positions = this.position.array, normals = this.normal.array;
    const from = current.positions, to = destination.positions;
    const normalFrom = current.normals, normalTo = destination.normals;
    if (blend === 0) positions.set(from);
    else for (let at = 0; at < positions.length; at++) positions[at] = from[at] + (to[at] - from[at]) * blend;
    normals.set(normalFrom);
    const active = hasRipple(ripples, this.serial), deform = createRippleDeformer(ripples, this.serial);
    const output = this.outputPoint;
    // Only surviving triangles are rendered. Collapsed/deleted source corners
    // retain their current interpolation and cost no wave/normal calculations.
    // Final stages therefore stay exactly empty, with no scattered ghost faces.
    for (const triangle of current.triangleIds) {
      const at = triangle * 9;
      // Keep unrounded CPU interpolation for identical line/surface sampling.
      const ax = from[at] + (to[at] - from[at]) * blend;
      const ay = from[at + 1] + (to[at + 1] - from[at + 1]) * blend;
      const az = from[at + 2] + (to[at + 2] - from[at + 2]) * blend;
      const bx = from[at + 3] + (to[at + 3] - from[at + 3]) * blend;
      const by = from[at + 4] + (to[at + 4] - from[at + 4]) * blend;
      const bz = from[at + 5] + (to[at + 5] - from[at + 5]) * blend;
      const cx = from[at + 6] + (to[at + 6] - from[at + 6]) * blend;
      const cy = from[at + 7] + (to[at + 7] - from[at + 7]) * blend;
      const cz = from[at + 8] + (to[at + 8] - from[at + 8]) * blend;
      if (blend !== 0) for (let corner = 0; corner < 3; corner++) {
        const offset = at + corner * 3;
        const nx = normalFrom[offset] + (normalTo[offset] - normalFrom[offset]) * blend;
        const ny = normalFrom[offset + 1] + (normalTo[offset + 1] - normalFrom[offset + 1]) * blend;
        const nz = normalFrom[offset + 2] + (normalTo[offset + 2] - normalFrom[offset + 2]) * blend;
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        normals[offset] = length > 1e-8 ? nx / length : 0;
        normals[offset + 1] = length > 1e-8 ? ny / length : 1;
        normals[offset + 2] = length > 1e-8 ? nz / length : 0;
      }
      if (!active) continue;
      deform(ax, ay, az, output);
      positions[at] = output[0]; positions[at + 1] = output[1]; positions[at + 2] = output[2];
      deform(bx, by, bz, output);
      positions[at + 3] = output[0]; positions[at + 4] = output[1]; positions[at + 5] = output[2];
      deform(cx, cy, cz, output);
      positions[at + 6] = output[0]; positions[at + 7] = output[1]; positions[at + 8] = output[2];
      // Rotate interpolated source normals by the recomputed face-normal change.
      // This preserves original smooth shading at onset/expiry instead of
      // abruptly replacing the source's normals with faceted normals on tap.
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const sx = uy * vz - uz * vy, sy = uz * vx - ux * vz, sz = ux * vy - uy * vx;
      const dux = positions[at + 3] - positions[at], duy = positions[at + 4] - positions[at + 1], duz = positions[at + 5] - positions[at + 2];
      const dvx = positions[at + 6] - positions[at], dvy = positions[at + 7] - positions[at + 1], dvz = positions[at + 8] - positions[at + 2];
      const dx = duy * dvz - duz * dvy, dy = duz * dvx - dux * dvz, dz = dux * dvy - duy * dvx;
      const originalLength = Math.sqrt(sx * sx + sy * sy + sz * sz);
      const deformedLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (originalLength < 1e-8 || deformedLength < 1e-8) continue;
      const nx = sx / originalLength, ny = sy / originalLength, nz = sz / originalLength;
      const mx = dx / deformedLength, my = dy / deformedLength, mz = dz / deformedLength;
      let qx = ny * mz - nz * my, qy = nz * mx - nx * mz, qz = nx * my - ny * mx;
      let qw = 1 + Math.max(-1, Math.min(1, nx * mx + ny * my + nz * mz));
      if (qw > 1.99999999) continue;
      if (qw < 1e-8) {
        // Deterministic orthogonal half-turn axis for a reversed normal.
        if (Math.abs(nx) > Math.abs(nz)) { qx = -ny; qy = nx; qz = 0; }
        else { qx = 0; qy = -nz; qz = ny; }
        qw = 0;
      }
      const inverse = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
      qx *= inverse; qy *= inverse; qz *= inverse; qw *= inverse;
      for (let corner = 0; corner < 3; corner++) {
        const offset = at + corner * 3, x = normals[offset], y = normals[offset + 1], z = normals[offset + 2];
        const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
        normals[offset] = x + qw * tx + qy * tz - qz * ty;
        normals[offset + 1] = y + qw * ty + qz * tx - qx * tz;
        normals[offset + 2] = z + qw * tz + qx * ty - qy * tx;
      }
    }
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
    return this.geometries;
  }

  dispose() {
    if (this.disposed) return;
    for (const geometry of this.geometries) geometry.dispose();
    this.disposed = true;
  }
}
