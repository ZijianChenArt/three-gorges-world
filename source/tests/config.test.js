import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { WORLD, assetUrl, getInitialSelection } from '../src/config.js';

test('production asset URLs remain relative for project Pages', () => {
  assert.equal(assetUrl('/models/three-gorges.glb', './'), './models/three-gorges.glb');
  assert.equal(assetUrl('models/a.glb', '/my-world/'), '/my-world/models/a.glb');
});
test('query selection accepts only declared views and modes', () => {
  assert.deepEqual(getInitialSelection(''), {mode:'source',view:'overview'});
  assert.deepEqual(getInitialSelection('?mode=signal&view=bloom'), {mode:'signal',view:'bloom'});
  assert.deepEqual(getInitialSelection('?mode=<script>&view=missing'), {mode:'source',view:'overview'});
});
test('curated viewpoints have unique ids and finite world coordinates', () => {
  assert.equal(new Set(WORLD.views.map(v=>v.id)).size, WORLD.views.length);
  for(const v of WORLD.views) {
    assert.equal(v.position.length,3); assert.equal(v.target.length,3);
    assert.ok([...v.position,...v.target].every(Number.isFinite));
    assert.ok(v.position[1]>0); assert.ok(v.target[1]>=0);
  }
});
test('asset exists with expected valid GLB v2 structure and compact size', () => {
  const bytes=readFileSync(new URL('../public/'+WORLD.model.url,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.ok(bytes.length<2_000_000);
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
  assert.equal(json.meshes.length,29);
  assert.equal(json.materials.length,8);
  assert.ok(!json.images?.length);
  assert.ok(!json.buffers.some(b=>b.uri));
  for (const accessor of json.accessors) {
    if(accessor.min) assert.ok(accessor.min.every(Number.isFinite));
    if(accessor.max) assert.ok(accessor.max.every(Number.isFinite));
  }
});
test('required controls, dialogs, and honest fallback provenance are present',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const id of ['world','panel-toggle','motion-toggle','reset-view','fullscreen-toggle','error-card','retry-button','about-dialog']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('不是三峡大坝原模型'));
  assert.ok(WORLD.model.provenance.includes('新创作'));
});
test('static fallback is packaged',()=>{
  assert.ok(existsSync(new URL('../public/images/preview.webp',import.meta.url)));
  assert.ok(existsSync(new URL('../public/.nojekyll',import.meta.url)));
});
