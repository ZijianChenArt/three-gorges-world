import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ArchivePrint,instancePose,getView} from './print-renderer.js';
import {extractSourceGeometries,applyMeshStage} from './mesh-source.js';
import {projectionParameters} from './flight-camera.js';
import {prepareSurfacePatches,phaseInfo} from './surface-patches.js';
import {StrokeRenderer} from './stroke-renderer.js';

export const MAX_GPU_INSTANCES=32;
export function effectiveStage(frame){return Math.min(6,frame.stage+(frame.committed?1:0));}
export function makePhysicalMaterials({phone=false}={}){
  return[
    new THREE.MeshPhysicalMaterial({color:0xc5c8c7,metalness:1,roughness:.21,clearcoat:.25,clearcoatRoughness:.2,envMapIntensity:1.2,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color:0x444744,metalness:0,roughness:.86,envMapIntensity:.7,side:THREE.DoubleSide}),
    new THREE.MeshPhysicalMaterial({color:0xe7eeeb,metalness:0,roughness:phone?.18:.095,transmission:phone?.72:.96,thickness:.42,ior:1.46,attenuationColor:0xcbd3ce,attenuationDistance:3,envMapIntensity:1.1,side:THREE.DoubleSide}),
    new THREE.MeshPhysicalMaterial({color:0xa4a7a4,metalness:.72,roughness:.38,clearcoat:.1,envMapIntensity:1,side:THREE.DoubleSide}),
  ];
}
export function matrixForPose(pose){const m=new THREE.Matrix4().makeRotationX(pose.lean);m.multiply(new THREE.Matrix4().makeRotationY(-pose.angle));m.scale(new THREE.Vector3(pose.scale,pose.scale,pose.scale));m.setPosition(...pose.position);return m;}
export function inspectionCamera(width,height,camera){const s=projectionParameters(width,height,getView(width,height),camera);return{...s,target:new THREE.Vector3(...s.target),eye:new THREE.Vector3(...s.eye),up:new THREE.Vector3(...s.up)};}
export function webgl2Available(){try{const probe=document.createElement('canvas'),gl=probe.getContext('webgl2',{failIfMajorPerformanceCaveat:true});if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true;}catch{return false;}}

/** Real GLB meshes, built-in physical materials and GPU-instanced stage morphs. */
export class PbrArchive{
  static async create(solidCanvas,overlayCanvas,wireData,faces,{onFailure=()=>{}}={}){
    const engine=new THREE.WebGLRenderer({canvas:solidCanvas,antialias:true,alpha:false,powerPreference:'high-performance',failIfMajorPerformanceCaveat:true});
    let result;
    try{result=new PbrArchive(engine,solidCanvas,overlayCanvas,wireData.groups,faces,onFailure);const gltf=await new GLTFLoader().loadAsync(new URL('models/three-gorges.glb',document.baseURI).href);result.sources=extractSourceGeometries(gltf.scene,wireData);gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});return result;}catch(error){if(result)result.dispose();else engine.dispose();throw error;}
  }
  constructor(engine,solidCanvas,overlayCanvas,groups,faces,onFailure){
    this.engine=engine;this.solidCanvas=solidCanvas;this.overlay=new ArchivePrint(overlayCanvas,groups,faces,{overlayOnly:true});this.ctx=this.overlay.ctx;this.frames=[];this.sources=[];this.buckets=new Map();this.camera={yaw:0,pitch:0,zoom:1,panX:0,panY:0};this.backend='webgl-pbr';this.phone=innerWidth<650;this.materials=makePhysicalMaterials({phone:this.phone});this.layerMaterials=new Map();this.scene=new THREE.Scene();this.strokes=new StrokeRenderer(this.scene);this.scene.background=new THREE.Color(0xf5f3ec);this.viewCamera=new THREE.PerspectiveCamera(45,1,.8,180);
    engine.outputColorSpace=THREE.SRGBColorSpace;engine.toneMapping=THREE.ACESFilmicToneMapping;engine.toneMappingExposure=1.05;engine.shadowMap.enabled=true;engine.shadowMap.type=THREE.PCFSoftShadowMap;engine.setClearColor(0xf5f3ec,1);engine.transmissionResolutionScale=this.phone?.4:.65;
    const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(engine);this.envTarget=pmrem.fromScene(environment,.025);this.scene.environment=this.envTarget.texture;this.scene.environmentIntensity=1;environment.dispose();pmrem.dispose();
    const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(-8,16,10);key.castShadow=true;key.shadow.mapSize.set(this.phone?1024:2048,this.phone?1024:2048);key.shadow.camera.left=-18;key.shadow.camera.right=18;key.shadow.camera.top=18;key.shadow.camera.bottom=-18;key.shadow.camera.near=.5;key.shadow.camera.far=55;key.shadow.normalBias=.035;key.shadow.bias=-.00012;key.shadow.radius=3;this.scene.add(key);this.key=key;
    const fill=new THREE.DirectionalLight(0xffffff,.6);fill.position.set(10,5,-8);this.scene.add(fill);this.scene.add(new THREE.HemisphereLight(0xffffff,0x7e807a,.5));
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshStandardMaterial({color:0xeeece5,roughness:.92,metalness:0}));this.floor.rotation.x=-Math.PI/2;this.floor.position.y=-7.7;this.floor.receiveShadow=true;this.scene.add(this.floor);
    const failOnce=reason=>{if(this.failed)return;this.failed=true;queueMicrotask(()=>onFailure(reason));};
    this.onLost=e=>{e.preventDefault();failOnce('WebGL 上下文中断');};solidCanvas.addEventListener('webglcontextlost',this.onLost);
    engine.debug.onShaderError=()=>failOnce('3D 着色器未能在此设备运行');
  }
  resize(w,h,dpr=1){this.width=w;this.height=h;this.engine.setPixelRatio(Math.min(dpr,this.phone?1.35:1.75));this.engine.setSize(w,h,false);this.overlay.resize(w,h,dpr);}
  draw(state){
    this.overlay.camera=this.camera;this.overlay.draw(state);this.frames=this.overlay.frames;this.summary=this.overlay.summary;this.bundleCount=this.overlay.bundleCount;
    const settings=inspectionCamera(this.width,this.height,this.camera);if(settings.perspective!==!!this.viewCamera.isPerspectiveCamera)this.viewCamera=settings.perspective?new THREE.PerspectiveCamera():new THREE.OrthographicCamera();const cam=this.viewCamera;if(settings.perspective){Object.assign(cam,{fov:settings.fov,aspect:settings.aspect,near:settings.near,far:settings.far});cam.setViewOffset(...settings.viewOffset);}else Object.assign(cam,{left:settings.left,right:settings.right,top:settings.top,bottom:settings.bottom,near:settings.near,far:settings.far});cam.position.copy(settings.eye);cam.up.copy(settings.up);cam.lookAt(settings.target);cam.updateProjectionMatrix();
    if(!this.layerMaterials)this.layerMaterials=new Map();if(!this.strokes)this.strokes=new StrokeRenderer(this.scene);
    const used=new Set(),visibleInstances=new Set();for(const bucket of this.buckets.values())bucket.pending=0;
    let triangles=0;
    for(const frame of this.frames){const source=this.sources[frame.instance.modelIndex],stage=effectiveStage(frame);if(!source||stage>=6||frame.edgeCount===0)continue;const patches=prepareSurfacePatches(source);
      for(let patch=0;patch<3;patch++){const phase=phaseInfo(frame.instance.key,patch,state.elapsed,{reducedMotion:state.reducedMotion}),level=Math.round(phase.surfaceAlpha*12);if(level===0)continue;const geometry=patches[stage][patch];if(!geometry.userData.triangleCount)continue;
        const materialKey=`${frame.instance.materialIndex}/${level}`;let material=this.layerMaterials.get(materialKey);if(!material){material=this.materials[frame.instance.materialIndex].clone();material.opacity=level/12;material.transparent=level<12;material.depthWrite=level>=9;material.polygonOffset=true;material.polygonOffsetFactor=1;material.polygonOffsetUnits=1;this.layerMaterials.set(materialKey,material);}
        const key=`${frame.instance.modelIndex}/${stage}/${frame.instance.materialIndex}/${patch}/${level}`;let bucket=this.buckets.get(key);
        if(!bucket){const dummy=new THREE.Mesh(geometry,material),mesh=new THREE.InstancedMesh(geometry,material,MAX_GPU_INSTANCES);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=level>=9;mesh.receiveShadow=true;mesh.setMorphAt(0,dummy);mesh.count=0;this.scene.add(mesh);bucket={mesh,dummy,pending:0};this.buckets.set(key,bucket);}
        bucket.dummy.morphTargetInfluences[0]=frame.committed?0:frame.blend;
        const index=bucket.pending++;bucket.mesh.setMatrixAt(index,matrixForPose(this.overlay.poses.get(frame.serial)||instancePose(frame.instance,this.width<650)));bucket.mesh.setMorphAt(index,bucket.dummy);used.add(key);visibleInstances.add(frame.serial);triangles+=geometry.userData.triangleCount;
      }
    }
    for(const[key,bucket]of this.buckets){if(!used.has(key)){this.scene.remove(bucket.mesh);bucket.mesh.dispose();this.buckets.delete(key);continue;}bucket.mesh.count=bucket.pending;bucket.mesh.instanceMatrix.needsUpdate=true;if(bucket.mesh.morphTexture)bucket.mesh.morphTexture.needsUpdate=true;}
    this.strokes.update(this.overlay.fields);this.renderedSegments=this.strokes.renderedSegments;this.renderedPoints=this.strokes.renderedPoints;
    this.renderedInstances=visibleInstances.size;this.triangleCount=triangles;this.drawGroups=this.buckets.size+Number(this.renderedSegments>0)+Number(this.renderedPoints>0);
    this.engine.setScissorTest(false);this.engine.clear();const top=Math.max(0,settings.view.top-27),bottom=Math.min(this.height,settings.view.bottom+24);this.engine.setScissor(0,this.height-bottom,this.width,bottom-top);this.engine.setScissorTest(true);this.engine.render(this.scene,cam);this.engine.setScissorTest(false);
  }
  pick(x,y){return this.overlay.pick(x,y);}
  centralTarget(){return this.overlay.centralTarget();}
  dispose(){this.solidCanvas.removeEventListener('webglcontextlost',this.onLost);for(const b of this.buckets.values())b.mesh.dispose();for(const m of this.materials)m.dispose();for(const m of this.layerMaterials.values())m.dispose();this.strokes.dispose();for(const source of this.sources)for(const stage of prepareSurfacePatches(source))for(const geometry of stage)geometry.dispose();for(const s of this.sources)for(const g of s.stageGeometries)g.dispose();this.envTarget?.dispose();this.floor.geometry.dispose();this.floor.material.dispose();this.engine.dispose();}
}
