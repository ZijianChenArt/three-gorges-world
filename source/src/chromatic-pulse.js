import {pulseIntensity} from './ripple.js';
/** A temporary tint on existing source edges. No new curves, offsets or marks. */
export function applyPulseTint(curves,ripples,serial){
  for(const curve of curves)delete curve.color;
  if(!ripples?.waves?.some(w=>w.serial===serial))return curves;
  for(const curve of curves){
    const local=curve.restLocal||curve.local||curve.points;
    let intensity=0;for(const point of local)intensity=Math.max(intensity,pulseIntensity(ripples,serial,point));
    if(intensity<.015)continue;
    const mix=((curve.edge?.[0]||0)*37+(curve.edge?.[1]||0)*13)%101/100;
    const tint=[.13+.55*mix,.63-.4*mix,.76-.24*mix];
    curve.color=tint.map(value=>.13+(value-.13)*intensity);
  }
  return curves;
}
