import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ArchivePrint,instancePose,getView} from './print-renderer.js';
import {extractSourceGeometries,applyMeshStage} from './mesh-source.js';

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
export function inspectionCamera(width,height,camera){
  const v=getView(width,height);v.scale*=camera.zoom;v.cx+=camera.panX*width;v.cy+=camera.panY*height;
  const yaw=-.47+camera.yaw,tilt=.43+camera.pitch,right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),up=new THREE.Vector3(-Math.sin(yaw)*Math.sin(tilt),Math.cos(tilt),-Math.cos(yaw)*Math.sin(tilt)),direction=new THREE.Vector3(Math.sin(yaw)*Math.cos(tilt),Math.sin(tilt),Math.cos(yaw)*Math.cos(tilt));
  const target=right.clone().multiplyScalar((width/2-v.cx)/v.scale).addScaledVector(up,(v.cy-height/2)/v.scale),eye=target.clone().addScaledVector(direction,65);
  return{view:v,target,eye,up,left:-width/(2*v.scale),right:width/(2*v.scale),top:height/(2*v.scale),bottom:-height/(2*v.scale)};
}
export function webgl2Available(){try{const probe=document.createElement('canvas'),gl=probe.getContext('webgl2',{failIfMajorPerformanceCaveat:true});if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true;}catch{return false;}}

/** Real GLB meshes, built-in physical materials and GPU-instanced stage morphs. */
export class PbrArchive{
  static async create(solidCanvas,overlayCanvas,wireData,faces,{onFailure=()=>{}}={}){
    const engine=new THREE.WebGLRenderer({canvas:solidCanvas,antialias:true,alpha:false,powerPreference:'high-performance',failIfMajorPerformanceCaveat:true});
    let result;
    try{result=new PbrArchive(engine,solidCanvas,overlayCanvas,wireData.groups,faces,onFailure);const gltf=await new GLTFLoader().loadAsync(new URL('models/three-gorges.glb',document.baseURI).href);result.sources=extractSourceGeometries(gltf.scene,wireData);gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});return result;}catch(error){if(result)result.dispose();else engine.dispose();throw error;}
  }
  constructor(engine,solidCanvas,overlayCanvas,groups,faces,onFailure){
    this.engine=engine;this.solidCanvas=solidCanvas;this.overlay=new ArchivePrint(overlayCanvas,groups,faces,{overlayOnly:true});this.ctx=this.overlay.ctx;this.frames=[];this.sources=[];this.buckets=new Map();this.camera={yaw:0,pitch:0,zoom:1,panX:0,panY:0};this.backend='webgl-pbr';this.phone=innerWidth<650;this.materials=makePhysicalMaterials({phone:this.phone});this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xf5f3ec);this.viewCamera=new THREE.OrthographicCamera(-15,15,12,-12,.1,150);
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
    const settings=inspectionCamera(this.width,this.height,this.camera),cam=this.viewCamera;Object.assign(cam,{left:settings.left,right:settings.right,top:settings.top,bottom:settings.bottom});cam.position.copy(settings.eye);cam.up.copy(settings.up);cam.lookAt(settings.target);cam.updateProjectionMatrix();
    const used=new Set();for(const bucket of this.buckets.values())bucket.pending=0;
    let triangles=0,rendered=0;
    for(const frame of this.frames){const source=this.sources[frame.instance.modelIndex],stage=effectiveStage(frame);if(!source||stage>=6||frame.edgeCount===0)continue;
      const key=`${frame.instance.modelIndex}/${stage}/${frame.instance.materialIndex}`;let bucket=this.buckets.get(key);
      if(!bucket){const dummy=new THREE.Mesh(source.geometry,this.materials[frame.instance.materialIndex]);applyMeshStage(dummy,source,frame.stage,frame.blend);const mesh=new THREE.InstancedMesh(dummy.geometry,this.materials[frame.instance.materialIndex],MAX_GPU_INSTANCES);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.setMorphAt(0,dummy);mesh.count=0;this.scene.add(mesh);bucket={mesh,dummy,pending:0};this.buckets.set(key,bucket);}
      applyMeshStage(bucket.dummy,source,frame.stage,frame.blend);bucket.mesh.geometry=bucket.dummy.geometry;
      const index=bucket.pending++;bucket.mesh.setMatrixAt(index,matrixForPose(instancePose(frame.instance,this.width<650)));bucket.mesh.setMorphAt(index,bucket.dummy);used.add(key);rendered++;triangles+=source.triangleCounts[stage];
    }
    for(const[key,bucket]of this.buckets){if(!used.has(key)){this.scene.remove(bucket.mesh);bucket.mesh.dispose();this.buckets.delete(key);continue;}bucket.mesh.count=bucket.pending;bucket.mesh.instanceMatrix.needsUpdate=true;if(bucket.mesh.morphTexture)bucket.mesh.morphTexture.needsUpdate=true;}
    this.renderedInstances=rendered;this.triangleCount=triangles;this.drawGroups=this.buckets.size;
    this.engine.setScissorTest(false);this.engine.clear();const top=Math.max(0,settings.view.top-27),bottom=Math.min(this.height,settings.view.bottom+24);this.engine.setScissor(0,this.height-bottom,this.width,bottom-top);this.engine.setScissorTest(true);this.engine.render(this.scene,cam);this.engine.setScissorTest(false);
  }
  dispose(){this.solidCanvas.removeEventListener('webglcontextlost',this.onLost);for(const b of this.buckets.values())b.mesh.dispose();for(const m of this.materials)m.dispose();for(const s of this.sources)for(const g of s.stageGeometries)g.dispose();this.envTarget?.dispose();this.floor.geometry.dispose();this.floor.material.dispose();this.engine.dispose();}
}
