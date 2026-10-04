import * as THREE from 'three';

export const SEGMENT_CAP = 9000;
/** Bounded real 3D line buffers derived only from surviving source edges. */
export class StrokeRenderer {
  constructor(scene) {
    this.scene = scene;
    this.linePositions = new Float32Array(SEGMENT_CAP * 6);
    this.lineColors = new Float32Array(SEGMENT_CAP * 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.lineColors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: .88, depthWrite: false, toneMapped: false});
    this.lines = new THREE.LineSegments(geometry, material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
    this.lines.visible = false;
    scene.add(this.lines);
    this.renderedSegments = 0;
    this.renderedPoints = 0;
  }

  update(fields) {
    let segments = 0;
    const shade = alpha => .89 - Math.max(0, Math.min(1, alpha)) * .79;
    for (const field of fields) {
      for (const curve of field.curves) {
        const gray = shade(curve.alpha);
        for (let i = 1; i < curve.points.length && segments < SEGMENT_CAP; i++) {
          const at = segments * 6;
          this.linePositions.set(curve.points[i - 1], at);
          this.linePositions.set(curve.points[i], at + 3);
          if(curve.color){const color=curve.color.map(v=>1-(1-v)*Math.max(0,Math.min(1,curve.alpha)));this.lineColors.set(color,at);this.lineColors.set(color,at+3);}else this.lineColors.fill(gray, at, at + 6);
          segments++;
        }
      }
    }
    this.lines.geometry.setDrawRange(0, segments * 2);
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
    this.lines.visible = segments > 0;
    this.renderedSegments = segments;
    this.renderedPoints = 0;
  }

  dispose() {
    this.scene.remove(this.lines);
    this.lines.geometry.dispose();
    this.lines.material.dispose();
  }
}
