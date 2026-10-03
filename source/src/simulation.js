/** A continuous, deterministic score. No input is needed for the artwork to unfold. */
export const CYCLE = 84;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const mix=(a,b,t)=>a+(b-a)*t;
export function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
export function createState({reducedMotion=false}={}){return{elapsed:0,paused:reducedMotion};}
export function advance(state,seconds){if(!state.paused&&Number.isFinite(seconds)&&seconds>0)state.elapsed+=seconds;}
export function phaseAt(elapsed){const phase=((elapsed%CYCLE)+CYCLE)%CYCLE;return phase<7?'forming':phase<29?'unfolding':phase<52?'weaving':phase<77?'reforming':'formed';}
const starts=[1,5,2.5,7,4], returns=[53,57,54,58,55.5];
export function morphAt(elapsed,group,height=.5){const phase=((elapsed%CYCLE)+CYCLE)%CYCLE,layer=(1-clamp(height,0,1))*2;return smooth(starts[group]+layer,starts[group]+layer+18,phase)*(1-smooth(returns[group]-layer,returns[group]-layer+18,phase));}
const anchors=[[-6,3,-3],[5,3,-4],[8,0,3],[-.5,-1,5.5],[-8,-.5,3]];
export function anchorAt(elapsed,group){const cycle=Math.floor(elapsed/CYCLE),phase=elapsed%CYCLE,t=smooth(29,49,phase),a=anchors[(group+cycle)%5],b=anchors[(group+cycle+1)%5];return a.map((n,i)=>mix(n,b[i],t));}
export function prepareModels(groups){return groups.map((g,index)=>{const size=g.bounds.max.map((v,i)=>v-g.bounds.min[i]),segments=[];
  // Sample long original edges before the nonlinear map so the wire bends continuously.
  for(let i=0;i<g.edges.length;i+=6){const a=g.edges.slice(i,i+3),b=g.edges.slice(i+3,i+6),length=Math.hypot(...a.map((v,k)=>(b[k]-v)/size[k])),steps=clamp(Math.ceil(length*9),1,8);for(let j=0;j<steps;j++){for(const t of [j/steps,(j+1)/steps])for(let k=0;k<3;k++)segments.push(mix(a[k],b[k],t));}}
  return{...g,index,size,segments,halfY:size[1]/2,scale:index===0?.8:1.04};});}
export function sourcePoint(model,x,y,z,elapsed){
  const g=model.index,a=anchorAt(elapsed,g),angle=Math.sin(elapsed*.13+g*.9)*.23+(g-2)*.13;
  const cy=Math.cos(angle),sy=Math.sin(angle),breath=1+Math.sin(elapsed*.38+g*1.2)*.035;
  const xx=(x*cy-z*sy)*model.scale*breath,zz=(x*sy+z*cy)*model.scale*breath;
  return[a[0]+xx,a[1]+(y-model.halfY)*model.scale*breath+Math.sin(elapsed*.3+g)*.22,a[2]+zz];
}
export function weavePoint(model,x,y,z,elapsed){
  const nx=x/(model.size[0]/2),ny=y/model.size[1],nz=z/(model.size[2]/2),g=model.index;
  // One continuous spatial map for every vertex: neighboring edges stay related.
  const u=(ny-.5)*1.1+nx*.43+nz*.12;
  const v=nz*.78-nx*.37;
  const phase=u*Math.PI*1.18+Math.sin(elapsed*.075)*.4+(g-2)*.08;
  const twist=phase*.77+elapsed*.046;
  return[11.3*u,2.7*Math.sin(phase)+v*1.6*Math.sin(twist),2.5*Math.cos(phase)+v*1.6*Math.cos(twist)+(g-2)*.16];
}
export function transformPoint(model,x,y,z,elapsed){const a=sourcePoint(model,x,y,z,elapsed),b=weavePoint(model,x,y,z,elapsed),t=morphAt(elapsed,model.index,y/model.size[1]);return a.map((v,i)=>mix(v,b[i],t));}
