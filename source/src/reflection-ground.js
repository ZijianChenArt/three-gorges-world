import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

/** A real, shallow planar reflection. Empty reflected background is transparent. */
export function createReflectionGround({phone=false}={}){
  const background=new THREE.Color(0xf5f3ec);
  const shader={
    uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},background:{value:background},strength:{value:phone?.19:.24}},
    vertexShader:`uniform mat4 textureMatrix; varying vec4 reflectedUv; varying vec2 localUv;
      void main(){reflectedUv=textureMatrix*vec4(position,1.0);localUv=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D tDiffuse; uniform vec3 background; uniform float strength; varying vec4 reflectedUv; varying vec2 localUv;
      void main(){vec3 reflected=texture2DProj(tDiffuse,reflectedUv).rgb;float edge=1.0-smoothstep(13.0,38.0,length(localUv));float difference=length(reflected-background);float presence=smoothstep(0.015,0.18,difference);gl_FragColor=vec4(reflected,strength*edge*presence);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  };
  const reflector=new Reflector(new THREE.PlaneGeometry(90,90),{textureWidth:phone?256:512,textureHeight:phone?256:512,multisample:0,clipBias:.003,color:0xffffff,shader});
  reflector.name='shallow-planar-reflection';reflector.rotation.x=-Math.PI/2;reflector.position.y=-7.7;reflector.material.transparent=true;reflector.material.depthWrite=false;reflector.renderOrder=-1;
  const renderReflection=reflector.onBeforeRender;let lastFrame=-Infinity;
  reflector.onBeforeRender=function(renderer,scene,camera){const frame=renderer.info.render.frame;if(frame-lastFrame<(phone?5:3))return;lastFrame=frame;const scissor=renderer.getScissorTest();renderer.setScissorTest(false);try{renderReflection.call(this,renderer,scene,camera);}finally{renderer.setScissorTest(scissor);}};
  reflector.userData.resolution=phone?256:512;reflector.userData.updateEvery=phone?5:3;reflector.userData.countsAsGeometry=false;
  return reflector;
}
