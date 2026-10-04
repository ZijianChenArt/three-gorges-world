import {materialIndexFor,WHITE_MATERIAL_INDEX} from './materials.js';
/** A fictional retention procedure. Counts always come from actual surviving edges. */
export const STEPS=[.065,.13,.26,.52,1.04,2.4];
export function hash(n){n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return(n^(n>>>15))>>>0;}
export const random=(seed,index)=>hash(seed+Math.imul(index+1,0x9e3779b9))/4294967296;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const key=p=>p.map(v=>Math.round(v*1e6)).join(',');
export function quantize(point,step){return point.map(v=>{const n=Math.round(v/step)*step;return Math.abs(n)<1e-9?0:n;});}
export function compactEdges(vertices,edges){const seen=new Set(),active=[];for(const[a,b]of edges){const ka=key(vertices[a]),kb=key(vertices[b]);if(ka===kb)continue;const k=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;if(seen.has(k))continue;seen.add(k);active.push([a,b]);}return active;}
export function prepareArchive(groups,faceGroups=[]){return groups.map((g,index)=>{
  const size=g.bounds.max.map((v,i)=>v-g.bounds.min[i]),unit=Math.max(...size)/2,halfY=size[1]/2,vertices=[],lookup=new Map(),edges=[];
  const local=p=>[p[0]/unit,(p[1]-halfY)/unit,p[2]/unit];
  const add=p=>{const n=local(p),k=key(n);if(!lookup.has(k)){lookup.set(k,vertices.length);vertices.push(n);}return lookup.get(k);};
  for(let i=0;i<g.edges.length;i+=6)edges.push([add(g.edges.slice(i,i+3)),add(g.edges.slice(i+3,i+6))]);
  const face=faceGroups.find(f=>f.id===g.id),faces=[];
  for(let i=0;i<(face?.triangles.length||0);i+=9)faces.push([add(face.triangles.slice(i,i+3)),add(face.triangles.slice(i+3,i+6)),add(face.triangles.slice(i+6,i+9))]);
  const stages=[{vertices,edges:compactEdges(vertices,edges)}];
  for(const step of STEPS){const prior=stages.at(-1),next=prior.vertices.map(p=>quantize(p,step));stages.push({vertices:next,edges:compactEdges(next,prior.edges)});}
  return{id:g.id,name:g.name,index,size,unit,halfY,faces,stages,bounds:size.map(v=>v/unit/2),sourceEdges:edges.length};
});}
export function makeInstance(serial,started,seed=271828,{includeCubes=false}={}){
  const key=hash(seed^Math.imul(serial,0x85ebca6b)),intro=5+random(key,1)*5,stepTime=4+random(key,2)*3,emptyHold=8+random(key,3)*10;
  // Keep all five originals in the opening. Lightweight cubes occupy five
  // additional slots and most later admissions without growing the render pool.
  const cube=includeCubes&&serial>5&&(serial<=10||(serial>14&&random(key,40)<.58));
  const materialSerial=includeCubes&&serial>=11&&serial<=14?[6,7,9,10][serial-11]:serial;
  return{serial,started,key,modelIndex:cube?5:serial<=5?serial-1:Math.floor(random(key,4)*5),materialIndex:cube?WHITE_MATERIAL_INDEX:materialIndexFor(hash(key^0x49d0a49b),materialSerial),intro,stepTime,emptyHold,end:started+intro+STEPS.length*stepTime+emptyHold};
}
export function desiredDensity(elapsed,seed,budget){
  // The detailed foreground grows; older records accumulate separately in bounded bundles.
  const growth=10+Math.floor(Math.sqrt(Math.max(0,elapsed)/1.4));
  return Math.min(budget,growth);
}
export function archiveBundles(state,limit=48){
  if(!state.closed)return[];
  const width=Math.max(1,Math.ceil(state.records/limit)),active=new Set(state.instances.map(i=>i.serial)),result=[];
  for(let from=1;from<=state.records;from+=width){const to=Math.min(state.records,from+width-1);let count=to-from+1;for(const id of active)if(id>=from&&id<=to)count--;if(count)result.push({from,to,count});}
  return result;
}
function admit(state,at){const item=makeInstance(++state.records,at,state.seed,{includeCubes:state.includeCubes});state.instances.push(item);return item;}
export function createState({reducedMotion=false,seed=271828,budget=24,initialCount=10,includeCubes=false}={}){
  const state={includeCubes:Boolean(includeCubes),elapsed:0,paused:reducedMotion,reducedMotion,seed:seed>>>0,budget:clamp(Math.round(budget),6,32),records:0,closed:0,instances:[],history:[],nextArrival:2.5,arrivalAttempt:0};
  for(let i=0;i<Math.min(state.budget,Math.max(6,initialCount));i++)admit(state,0);
  return state;
}
export function setBudget(state,budget){state.budget=clamp(Math.round(budget),6,32);}
function retire(state,at){
  const remaining=[];for(const item of state.instances){if(item.end<=at){state.closed++;state.history.push(item);}else remaining.push(item);}
  state.instances=remaining;state.history=state.history.slice(-8);
}
export function advance(state,seconds){
  if(state.paused||!Number.isFinite(seconds)||seconds<=0)return;
  const end=state.elapsed+seconds;
  while(state.nextArrival<=end){const at=state.nextArrival;retire(state,at);const target=desiredDensity(at,state.seed,state.budget);
    if(state.instances.length<target)admit(state,at);
    const attempt=++state.arrivalAttempt,key=hash(state.seed^Math.imul(attempt,0xc2b2ae35));
    const interval=.55+random(key,0)*1.65;
    state.nextArrival=at+interval;
  }
  retire(state,end);state.elapsed=end;
}
export function stateAt(elapsed,options={}){const s=createState(options);advance(s,elapsed);return s;}
export function instanceFrame(model,instance,elapsed,{coordinates=true}={}){
  const age=Math.max(0,elapsed-instance.started),work=age-instance.intro,stage=clamp(Math.floor(Math.max(0,work)/instance.stepTime),0,STEPS.length);
  const blend=stage===STEPS.length||work<0?0:smooth((work-stage*instance.stepTime)/(instance.stepTime*.84)),from=model.stages[stage],to=model.stages[Math.min(stage+1,STEPS.length)],committed=blend===1,activeEdges=committed?to.edges:from.edges;
  const vertices=!coordinates?from.vertices:blend===0?from.vertices:blend===1?to.vertices:from.vertices.map((p,i)=>p.map((v,j)=>v+(to.vertices[i][j]-v)*blend));
  return{model,instance,vertices,activeEdges,edgeCount:activeEdges.length,stage,blend,phase:stage===STEPS.length?'retained':work<0?'registered':committed?'merged':'quantizing',time:age,serial:instance.serial,step:STEPS[Math.min(stage,STEPS.length-1)],committed};
}
export function summary(frames,state){return{records:state.records,closed:state.closed,visible:frames.length,substantial:frames.filter(f=>f.edgeCount>0).length,edges:frames.reduce((n,f)=>n+f.activeEdges.length,0),empty:frames.every(f=>f.activeEdges.length===0),phase:frames.some(f=>f.phase==='quantizing')?'quantizing':frames.every(f=>f.phase==='retained')?'retained':'registered'};}
export function triangleArea(a,b,c){const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;}
