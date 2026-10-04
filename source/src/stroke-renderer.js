import * as THREE from 'three';

export const SEGMENT_CAP=9000,POINT_CAP=900;
/** Bounded real 3D line/point buffers. Every coordinate is derived from a surviving source edge. */
export class StrokeRenderer{
  constructor(scene){
    this.scene=scene;this.linePositions=new Float32Array(SEGMENT_CAP*6);this.lineColors=new Float32Array(SEGMENT_CAP*6);this.pointPositions=new Float32Array(POINT_CAP*3);this.pointColors=new Float32Array(POINT_CAP*3);
    const geometry=(p,c)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(c,3).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);return g;};
    this.lines=new THREE.LineSegments(geometry(this.linePositions,this.lineColors),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.88,depthWrite:false,toneMapped:false}));
    this.points=new THREE.Points(geometry(this.pointPositions,this.pointColors),new THREE.PointsMaterial({vertexColors:true,size:.055,sizeAttenuation:true,transparent:true,opacity:.85,depthWrite:false,toneMapped:false}));
    for(const o of[this.lines,this.points]){o.frustumCulled=false;o.renderOrder=4;scene.add(o);}this.renderedSegments=0;this.renderedPoints=0;
  }
  update(fields){
    let segments=0,points=0;const shade=alpha=>.89-Math.max(0,Math.min(1,alpha))*.79;
    for(const field of fields){for(const curve of field.curves){const gray=shade(curve.alpha);for(let i=1;i<curve.points.length&&segments<SEGMENT_CAP;i++){const at=segments*6;this.linePositions.set(curve.points[i-1],at);this.linePositions.set(curve.points[i],at+3);this.lineColors.fill(gray,at,at+6);segments++;}}for(const point of field.points){if(points>=POINT_CAP)break;const at=points*3;this.pointPositions.set(point.position,at);this.pointColors.fill(shade(point.alpha),at,at+3);points++;}}
    this.lines.geometry.setDrawRange(0,segments*2);this.points.geometry.setDrawRange(0,points);for(const o of[this.lines,this.points]){o.geometry.attributes.position.needsUpdate=true;o.geometry.attributes.color.needsUpdate=true;o.visible=o.geometry.drawRange.count>0;}
    this.renderedSegments=segments;this.renderedPoints=points;
  }
  dispose(){for(const o of[this.lines,this.points]){this.scene.remove(o);o.geometry.dispose();o.material.dispose();}}
}
