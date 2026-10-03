import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, PerspectiveCamera } from 'three';
import { fitPositionToBox } from '../src/camera-fit.js';
const box = new Box3(new Vector3(-11, 0, -7.239), new Vector3(11, 6.782, 7.239));
for (const [width, height] of [[1440,1000],[768,1024],[600,900],[390,844],[844,390],[320,568]]) {
  test(`overview fits at ${width}×${height}`,()=>{
    const target = new Vector3(0,2,0), original = new Vector3(24,17,27);
    const position = fitPositionToBox(original,target,box,40,width/height);
    const camera = new PerspectiveCamera(40,width/height,.03,190);
    camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld(true);
    assert.ok(position.distanceTo(target) >= original.distanceTo(target));
    for (const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]) {
      const p = new Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(p.x)<=.86001 && Math.abs(p.y)<=.86001);
      assert.ok(p.z<1 && p.z>-1);
    }
  });
}
