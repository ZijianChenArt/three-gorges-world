/** Seeded choices happen between lifecycles, never randomly frame by frame. */
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const mix=(a,b,t)=>a+(b-a)*t;
export function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
export function hash(value){let x=value|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return(x^(x>>>15))>>>0;}
export function random(seed,index=0){return hash((seed+Math.imul(index+1,0x9e3779b9))|0)/4294967296;}
export const MATERIALS = ['contours', 'filaments', 'constellations', 'echoes'];
export function makeCycle(seed,id,index,start=0){
  const key=hash(seed^Math.imul(id+1,0x85ebca6b)^Math.imul(index+1,0xc2b2ae35));
  const hold=index===0?[1.5,22,7,38,13][id]+random(key,1)*5:9+random(key,1)*16;
  const release=19+random(key,2)*15,roam=17+random(key,3)*23,gather=20+random(key,4)*16,rest=5+random(key,5)*8;
  const style=index===0?(id+Math.floor(random(seed,8)*5))%5:Math.floor(random(key,7)*5);
  return{id,index,start,key,hold,release,roam,gather,rest,duration:hold+release+roam+gather+rest,style,
    material:index===0?style%4:Math.floor(random(key,12)*4),angle:random(key,8)*Math.PI*2,spread:.8+random(key,9)*.5};
}
export function createState({reducedMotion=false,seed=271828}={}){return{elapsed:0,interactionTime:0,reducedMotion,paused:reducedMotion,seed:seed>>>0,gathers:Array.from({length:5},()=>({value:0,target:0})),pulses:[],scores:Array.from({length:5},(_,id)=>makeCycle(seed,id,0))};}
export function advance(state,seconds){
  if(!Number.isFinite(seconds)||seconds<=0)return;
  state.interactionTime+=seconds;
  for(const g of state.gathers){g.value=state.reducedMotion?g.target:mix(g.value,g.target,1-Math.exp(-seconds*4.5));if(Math.abs(g.value-g.target)<.0001)g.value=g.target;}
  state.pulses=state.pulses.filter(p=>state.interactionTime-p.started<2.8);
  if(state.paused)return;
  state.elapsed+=seconds;
  for(let id=0;id<5;id++){let s=state.scores[id];while(state.elapsed-s.start>=s.duration)s=makeCycle(state.seed,id,s.index+1,s.start+s.duration);state.scores[id]=s;}
}
export function setGather(state,id,active){if(!state.gathers[id])return;state.gathers[id].target=active?1:0;}
export function addRipple(state,id,point){if(!state.scores[id]||!point?.every(Number.isFinite))return;state.pulses.push({id,point:[...point],started:state.interactionTime});state.pulses=state.pulses.slice(-5);}
export function applyInteractions(frame,model,state,edgeIndex){
  if(!state)return frame;
  const amount=state.gathers[model.index].value,i=edgeIndex*6;
  if(amount>0){for(const k of [0,3]){const p=sourcePoint(model,...model.edges.slice(i+k,i+k+3),state.elapsed);for(let j=0;j<3;j++)frame[k+j]=mix(frame[k+j],p[j],amount);}frame[6]=mix(frame[6],.68,amount);frame[7]*=1-amount;}
  if(!state.reducedMotion)for(const pulse of state.pulses){const age=state.interactionTime-pulse.started,radius=age*5+.15;
    for(const k of [0,3]){const d=frame.slice(k,k+3).map((v,j)=>v-pulse.point[j]),distance=Math.hypot(...d)||.001,strength=.42*Math.exp(-age*.9)*Math.exp(-((distance-radius)**2)/2.4)*Math.sin(Math.min(1,age*5)*Math.PI/2);for(let j=0;j<3;j++)frame[k+j]+=d[j]/distance*strength;}}
  return frame;
}
export function stateAt(elapsed,seed=271828){const s=createState({seed});advance(s,elapsed);return s;}
export function phaseFor(score,elapsed){const age=elapsed-score.start;return age<score.hold?'resting':age<score.hold+score.release?'releasing':age<score.hold+score.release+score.roam?'drifting':age<score.duration-score.rest?'returning':'formed';}
export function edgeAmount(score,elapsed,releaseDelay=0,returnDelay=0){const age=elapsed-score.start,first=score.hold,last=score.hold+score.release+score.roam;return smooth(first+releaseDelay*score.release*.42,first+score.release,age)*(1-smooth(last+returnDelay*score.gather*.25,last+score.gather,age));}
export const anchors=[[-6,3,-3],[5,3,-4],[8,0,3],[-.5,-1,5.5],[-8,-.5,3]];
export function prepareModels(groups){return groups.map((g,index)=>{const size=g.bounds.max.map((v,i)=>v-g.bounds.min[i]);return{...g,index,size,halfY:size[1]/2,scale:index===0?.8:1.04};});}
export function sourcePoint(model,x,y,z,elapsed){const g=model.index,a=anchors[g],angle=Math.sin(elapsed*.071+g*.9)*.16+(g-2)*.13,cy=Math.cos(angle),sy=Math.sin(angle),breath=1+Math.sin(elapsed*.16+g*1.2)*.022;return[a[0]+(x*cy-z*sy)*model.scale*breath,a[1]+(y-model.halfY)*model.scale*breath+Math.sin(elapsed*.12+g)*.15,a[2]+(x*sy+z*cy)*model.scale*breath];}
export function makeTraits(score,edgeIndex){const key=hash(score.key+Math.imul(edgeIndex+1,0x27d4eb2d));return Array.from({length:16},(_,i)=>random(key,i));}
export function detachedCenter(model,score,traits,elapsed){const a=anchors[model.index],u=traits[2],v=traits[3],w=traits[4],theta=u*Math.PI*2,r=2.4+v*6.5;let x,y,z;
  switch(score.style){case 0:x=Math.cos(theta)*r;y=(w*2-1)*r*.62;z=Math.sin(theta)*r*.72;break;case 1:x=(u*2-1)*5+Math.sin(v*6)*1.4;y=1+v*8;z=(w*2-1)*5;break;case 2:x=(u*2-1)*10;y=(v*2-1)*1.8;z=(w*2-1)*7;break;case 3:x=Math.cos(theta)*r;y=Math.sin(theta)*r*.54;z=(w*2-1)*5;break;default:x=(u*2-1)*5+w*2;y=-1-v*7;z=(w*2-1)*7;}
  if(score.material===2 && traits[9]<.33){
    // Endpoint dots belong to small orbital families, rather than uniform dust.
    const family=Math.floor(u*4),orbit=score.angle+family*Math.PI/2+elapsed*.025;
    const radius=2.7+score.spread*1.7,localAngle=traits[5]*Math.PI*2,localRadius=.3+v*1.5;
    x=Math.cos(orbit)*radius+Math.cos(localAngle+elapsed*.04)*localRadius;
    y=Math.sin(orbit*.7+family)*1.2+(w-.5)*2.2;
    z=Math.sin(orbit)*radius+Math.sin(localAngle+elapsed*.04)*localRadius;
  }
  const angle=score.angle*.35,ca=Math.cos(angle),sa=Math.sin(angle),xx=x*ca-z*sa,zz=x*sa+z*ca,f=.035+traits[5]*.038,p=traits[6]*Math.PI*2;
  x=a[0]+xx*score.spread+Math.sin(elapsed*f+p)*1.25;y=a[1]+y*score.spread+Math.sin(elapsed*f*.79+p+1)*.95;z=a[2]+zz*score.spread+Math.cos(elapsed*f*.91+p)*1.1;
  return[17*Math.tanh(x/17),11*Math.tanh(y/11),12*Math.tanh(z/12)];
}
export function edgeFrame(model,score,elapsed,edgeIndex,traits=makeTraits(score,edgeIndex)){
  const i=edgeIndex*6,e=model.edges,a=sourcePoint(model,e[i],e[i+1],e[i+2],elapsed),b=sourcePoint(model,e[i+3],e[i+4],e[i+5],elapsed),amount=edgeAmount(score,elapsed,traits[0],traits[1]);
  if(amount===0)return[...a,...b,.68,0,0];
  const center=detachedCenter(model,score,traits,elapsed),delta=a.map((v,k)=>(b[k]-v)*(.1+traits[7]*.23)),angle=traits[8]*Math.PI*2+Math.sin(elapsed*.051+traits[6]*6)*.5,ca=Math.cos(angle),sa=Math.sin(angle),dx=delta[0]*ca-delta[1]*sa,dy=delta[0]*sa+delta[1]*ca,dz=delta[2];
  const da=[center[0]-dx/2,center[1]-dy/2,center[2]-dz/2],db=[center[0]+dx/2,center[1]+dy/2,center[2]+dz/2];
  const dotted=traits[9]<.33,remnant=dotted?0:traits[10]>.86?.3:.008,lineAlpha=.68*(Math.pow(1-amount,1.25)+amount*remnant),dotAlpha=dotted&&traits[10]<.17?smooth(.18,.9,amount)*(.2+traits[11]*.3):0;
  return[...a.map((v,k)=>mix(v,da[k],amount)),...b.map((v,k)=>mix(v,db[k],amount)),lineAlpha,dotAlpha,.36+traits[11]*.38];
}
