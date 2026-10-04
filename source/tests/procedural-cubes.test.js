import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {withProceduralCubes, prepareCubeSource, prepareRuntimeSources, CUBE_SOURCE_ID} from '../src/procedural-cubes.js';
import {prepareArchive, createState, advance, stateAt, instanceFrame, summary, archiveBundles} from '../src/archive.js';
import {instancePose, ArchivePrint} from '../src/print-renderer.js';
import {prepareSurfacePatches, phaseInfo} from '../src/surface-patches.js';
import {PbrArchive, effectiveStage, makePhysicalMaterials} from '../src/pbr-renderer.js';
import {MATERIAL_KINDS, WHITE_MATERIAL_INDEX, shadeFacet} from '../src/materials.js';
import {createRippleState, emitRipple, advanceRipples} from '../src/ripple.js';

const wireBytes=readFileSync(new URL('../public/models/sculpture-wireframes.json',import.meta.url));
const faceBytes=readFileSync(new URL('../public/models/sculpture-faces.json',import.meta.url));
const glb=readFileSync(new URL('../public/models/three-gorges.glb',import.meta.url));
const wire=JSON.parse(wireBytes),faces=JSON.parse(faceBytes);
const originalWire=JSON.stringify(wire),originalFaces=JSON.stringify(faces);
const runtime=withProceduralCubes(wire,faces);
const models=prepareArchive(runtime.wireData.groups,runtime.faceData.groups);
const cube=models.at(-1),source=prepareCubeSource();
const loaded=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
const sources=prepareRuntimeSources(loaded.scene,runtime.wireData);

test('runtime adds one real centered cube with 12 edges and 12 triangles without changing source bytes',()=>{
  assert.equal(runtime.wireData.groups.length,6);assert.equal(runtime.faceData.groups.length,6);
  assert.equal(cube.id,CUBE_SOURCE_ID);assert.equal(cube.sourceEdges,12);assert.equal(cube.faces.length,12);
  assert.equal(cube.stages[0].vertices.length,8);assert.deepEqual(cube.bounds,[1,1,1]);
  assert.ok(cube.stages[0].vertices.every(point=>point.every(value=>Math.abs(value)===1)));
  assert.equal(source.sourceTriangles,12);assert.equal(source.geometry.index.count,36);
  assert.equal(sources.length,6);assert.equal(sources.slice(0,5).reduce((n,s)=>n+s.sourceTriangles,0),28384);
  assert.equal(sources.reduce((n,s)=>n+s.sourceTriangles,0),28396);
  for(let i=0;i<5;i++){assert.equal(runtime.wireData.groups[i],wire.groups[i]);assert.equal(runtime.faceData.groups[i],faces.groups[i]);}
  assert.equal(JSON.stringify(wire),originalWire);assert.equal(JSON.stringify(faces),originalFaces);
  assert.equal(createHash('sha256').update(glb).digest('hex'),wire.sourceSHA256);
  assert.deepEqual(readFileSync(new URL('../public/models/sculpture-wireframes.json',import.meta.url)),wireBytes);
  assert.deepEqual(readFileSync(new URL('../public/models/sculpture-faces.json',import.meta.url)),faceBytes);
  assert.equal(withProceduralCubes(runtime.wireData,runtime.faceData).wireData,runtime.wireData);
});

test('cube stages preserve native per-face UVs and reduce to exactly zero through the shared pipeline',()=>{
  const box=new THREE.BoxGeometry(2,2,2),original=box.toNonIndexed(),uv=source.geometry.attributes.uv;
  assert.deepEqual(uv.array,original.attributes.uv.array);
  assert.deepEqual(source.stages[0].positions,original.attributes.position.array);
  assert.deepEqual(cube.stages.map(stage=>stage.edges.length),[12,12,12,12,12,12,0]);
  assert.deepEqual(source.triangleCounts,[12,12,12,12,12,12,0]);
  for(const [stage,geometry] of source.stageGeometries.entries()){
    assert.equal(geometry.attributes.uv,uv);assert.equal(geometry.index.count/3,source.triangleCounts[stage]);
    assert.equal(geometry.morphAttributes.position.length,1);
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    const patches=prepareSurfacePatches(source)[stage];
    assert.equal(patches.reduce((n,p)=>n+p.index.count/3,0),source.triangleCounts[stage]);
    for(const patch of patches){assert.equal(patch.attributes.uv,uv);assert.equal(patch.attributes.position,geometry.attributes.position);}
  }
  assert.ok(source.stages.at(-1).positions.every(value=>value===0));
  assert.ok(cube.stages.at(-1).vertices.flat().every(value=>value===0));
  box.dispose();original.dispose();
});

test('cube intake is opt-in, seeded, varied in size and bounded without adding heavy opening meshes',()=>{
  assert.ok(createState({initialCount:14}).instances.every(i=>i.modelIndex<5));
  for(const seed of[0,1,7331,271828,999999])for(const [count,budget,phone] of[[14,26,false],[10,16,true]]){
    const state=createState({includeCubes:true,initialCount:count,budget,seed});
    assert.deepEqual(state.instances.slice(0,5).map(i=>i.modelIndex),[0,1,2,3,4]);
    const cubes=state.instances.filter(i=>i.modelIndex===5);
    assert.equal(cubes.length,5);assert.equal(state.instances.length,count);
    assert.ok(state.instances.filter(i=>i.modelIndex<5).length<=(phone?8:12));
    const scales=cubes.map(i=>instancePose(i,phone).scale);
    assert.ok(scales.some(s=>s<.6));assert.ok(scales.some(s=>s>=.65&&s<=1));assert.ok(scales.some(s=>s>=1.1));
    for(const item of cubes){const pose=instancePose(item,phone);assert.equal(item.materialIndex,WHITE_MATERIAL_INDEX);assert.ok(pose.scale>=.3&&pose.scale<=1.5);assert.ok(pose.position.every(Number.isFinite));}
    assert.equal(new Set(cubes.map(i=>instancePose(i,phone).position[2])).size,5);
    assert.deepEqual(state,createState({includeCubes:true,initialCount:count,budget,seed}));
  }
  const a=createState({includeCubes:true,seed:7331}),b=createState({includeCubes:true,seed:7331});
  advance(a,240);for(let n=0;n<2400;n++)advance(b,.1);
  assert.deepEqual(a.instances.map(i=>[i.serial,i.modelIndex,i.materialIndex]),b.instances.map(i=>[i.serial,i.modelIndex,i.materialIndex]));
  for(const time of[600,3600,86400]){
    const state=stateAt(time,{includeCubes:true,budget:16,initialCount:10});assert.ok(state.instances.length<=16);
    const frames=state.instances.map(i=>instanceFrame(models[i.modelIndex],i,time)),totals=summary(frames,state);
    assert.equal(totals.edges,frames.reduce((n,f)=>n+f.edgeCount,0));
    assert.equal(state.records,state.closed+state.instances.length);assert.equal(archiveBundles(state).reduce((n,b)=>n+b.count,0),state.closed);
    for(const i of state.instances.filter(i=>i.modelIndex===5))for(const phone of[false,true]){
      const pose=instancePose(i,phone,{elapsed:time});assert.ok(pose.scale>=.3&&pose.scale<=1.5);
      assert.ok(pose.position.every(Number.isFinite));
    }
  }
});

test('the appended white finish has neutral physical and compatibility lighting, with no gradient map',()=>{
  assert.equal(MATERIAL_KINDS[WHITE_MATERIAL_INDEX],'white');
  const materials=makePhysicalMaterials(),white=materials[WHITE_MATERIAL_INDEX];
  assert.equal(white.color.getHex(),0xffffff);assert.equal(white.metalness,0);assert.ok(white.roughness>=.7);
  assert.equal(white.transmission,0);assert.equal(white.map,null);
  const shade=shadeFacet({material:'white',normal:[1,0,0],view:[0,0,1]});
  assert.equal(shade.fill.slice(1,3),shade.fill.slice(3,5));assert.equal(shade.fill.slice(3,5),shade.fill.slice(5));assert.equal(shade.alpha,1);
  for(const material of materials){material.map?.dispose();material.dispose();}
});

test('mixed PBR scene submits exact cube faces once, shares sources, and isolates one local cube ripple',()=>{
  const p=Object.create(PbrArchive.prototype),ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  p.overlay=new ArchivePrint({getContext:()=>ctx},runtime.wireData.groups,runtime.faceData.groups,{overlayOnly:true});
  p.overlay.resize(1188,762);p.width=1188;p.height=762;p.camera={yaw:0,pitch:0,zoom:1,panX:0,panY:0};
  p.sources=sources;p.scene=new THREE.Scene();p.viewCamera=new THREE.OrthographicCamera();p.buckets=new Map();p.materials=makePhysicalMaterials();
  p.engine={setScissorTest(){},clear(){},render(){}};
  const state=createState({includeCubes:true,budget:26,initialCount:14});state.ripples=createRippleState();
  const sourcePositions=sources[5].stages[0].positions.slice(),uv=sources[5].geometry.attributes.uv;
  p.draw(state);const before=p.triangleCount,initialPoses=[...p.overlay.poses.values()];
  const expected=p.frames.reduce((n,f)=>n+(f.edgeCount?prepareSurfacePatches(sources[f.instance.modelIndex])[effectiveStage(f)].reduce((sum,g,patch)=>sum+(Math.round(phaseInfo(f.instance.key,patch,state.elapsed).surfaceAlpha*12)>0?g.userData.triangleCount:0),0):0),0);
  assert.equal(before,expected);assert.ok(p.buckets.size<=state.instances.length*3);
  const cubeBuckets=[...p.buckets].filter(([key])=>key.startsWith('5/'));
  assert.equal(cubeBuckets.reduce((n,[,b])=>n+b.mesh.geometry.userData.triangleCount*b.mesh.count,0),60);
  assert.ok(emitRipple(state.ripples,{serial:6,origin:[1,1,1]}));advanceRipples(state.ripples,.95);p.draw(state);
  assert.equal(p.triangleCount,before);assert.equal(p.rippleMeshes.size,1);assert.ok(p.rippleMeshes.has(6));
  assert.deepEqual([...p.overlay.poses.values()],initialPoses);assert.deepEqual(sources[5].stages[0].positions,sourcePositions);
  const response=p.rippleMeshes.get(6);assert.ok(response.geometry.position.array.some((v,i)=>Math.abs(v-sourcePositions[i])>1e-5));
  for(const geometry of response.geometry.geometries)assert.equal(geometry.attributes.uv,uv);
  assert.equal([...p.buckets].filter(([key])=>key.startsWith('5/')).reduce((n,[,b])=>n+b.mesh.geometry.userData.triangleCount*b.mesh.count,0),48);
  state.elapsed=100;p.draw(state);assert.equal(p.triangleCount,0);assert.equal(p.buckets.size,0);assert.equal(p.rippleMeshes.size,0);
  p.strokes.dispose();for(const m of p.layerMaterials.values())m.dispose();for(const m of p.materials){m.map?.dispose();m.dispose();}
});
