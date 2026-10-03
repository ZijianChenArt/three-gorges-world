import {clamp} from './simulation.js';
export const createCamera=()=>({yaw:0,pitch:0,zoom:1,panX:0,panY:0});
export function orbitCamera(camera,dx,dy){camera.yaw+=dx*.008;camera.pitch=clamp(camera.pitch+dy*.006,-1.15,1.15);}
export function panCamera(camera,dx,dy,width,height){camera.panX=clamp(camera.panX+dx/Math.max(1,width),-.48,.48);camera.panY=clamp(camera.panY+dy/Math.max(1,height),-.48,.48);}
export function zoomCamera(camera,factor){if(Number.isFinite(factor)&&factor>0)camera.zoom=clamp(camera.zoom*factor,.55,2.6);}
export function resetCamera(camera){Object.assign(camera,createCamera());}
