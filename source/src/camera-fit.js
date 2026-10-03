import { Vector3 } from 'three';

/** Back up along a curated direction only as far as needed to keep the box in view. */
export function fitPositionToBox(position, target, box, verticalFov, aspect, margin = .86) {
  const direction = position.clone().sub(target).normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const halfHeight = Math.tan(verticalFov * Math.PI / 360) * margin;
  const halfWidth = halfHeight * aspect;
  let distance = position.distanceTo(target);
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new Vector3(x, y, z).sub(target);
    const depth = point.dot(direction);
    distance = Math.max(distance, depth + Math.abs(point.dot(right)) / halfWidth, depth + Math.abs(point.dot(up)) / halfHeight);
  }
  return target.clone().addScaledVector(direction, distance);
}
