import {pulseIntensity} from './ripple.js';
export const MAX_PULSE_SEGMENTS=80;
const COLORS=[[.06,.68,.87],[.85,.13,.48]];
/** Two fleeting spectral fringes follow ONLY current surviving source curves. */
export function chromaticFringes(curves,ripples,serial,toWorld=p=>p){
  const output=[];if(!ripples?.waves?.some(w=>w.serial===serial))return output;let used=0;
  for(const curve of curves){for(let i=1;i<curve.local.length&&used<MAX_PULSE_SEGMENTS;i++){
    const a=curve.local[i-1],b=curve.local[i],ra=(curve.restLocal||curve.local)[i-1],rb=(curve.restLocal||curve.local)[i];
    const intensity=pulseIntensity(ripples,serial,ra.map((v,j)=>(v+rb[j])/2));if(intensity<.015)continue;
    const tangent=b.map((v,j)=>v-a[j]),length=Math.hypot(...tangent);if(length<1e-8)continue;
    let normal=[-tangent[2],0,tangent[0]],m=Math.hypot(...normal);if(m<1e-8){normal=[0,-tangent[2],tangent[1]];m=Math.hypot(...normal);}if(m<1e-8)continue;
    const width=.01+.023*intensity;
    for(let side=0;side<2;side++){const offset=normal.map(v=>v/m*width*(side?1:-1)),local=[a,b].map(p=>p.map((v,j)=>v+offset[j]));output.push({local,points:local.map(toWorld),alpha:intensity,color:COLORS[side],chromatic:true,edge:curve.edge,patch:curve.patch});}used++;
  }}
  return output;
}
