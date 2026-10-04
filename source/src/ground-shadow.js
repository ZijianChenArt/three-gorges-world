import * as THREE from 'three';
/** Transparent receiver: only soft cast shadows are visible, never a floor color. */
export function createGroundShadow({phone=false}={}){
  const material=new THREE.ShadowMaterial({color:0x30332f,opacity:phone?.13:.17,transparent:true,depthWrite:false});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(90,90),material);ground.name='soft-shadow-receiver';ground.rotation.x=-Math.PI/2;ground.position.y=-7.7;ground.receiveShadow=true;ground.castShadow=false;ground.userData.countsAsGeometry=false;return ground;
}
export function configureGroundShadowLight(light,{phone=false}={}){
  light.castShadow=true;light.shadow.mapSize.set(phone?512:1024,phone?512:1024);
  Object.assign(light.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:.5,far:60});
  light.shadow.normalBias=.035;light.shadow.bias=-.00012;light.shadow.radius=3;return light;
}
