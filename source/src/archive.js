/** A fictional retention procedure. Counts always come from actual surviving edges. */
export const STEPS=[.065,.13,.26,.52,1.04,2.4];
export const INTRO=8,STEP_TIME=7,STAGGER=2.4,EMPTY_HOLD=12,RELOAD=4;
export const END=INTRO+STEPS.length*STEP_TIME+4*STAGGER;
export const CYCLE=END+EMPTY_HOLD+RELOAD;
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
export function createState({reducedMotion=false}={}){return{elapsed:0,paused:reducedMotion,reducedMotion};}
export function advance(state,seconds){if(!state.paused&&Number.isFinite(seconds)&&seconds>0)state.elapsed+=seconds;}
export function stateAt(elapsed){return{...createState(),elapsed};}
export function frameFor(model,elapsed){
  const round=Math.floor(elapsed/CYCLE),time=elapsed-round*CYCLE,waiting=round>0&&time<model.index*STAGGER,instanceRound=waiting?round-1:round,age=time-INTRO-model.index*STAGGER;
  let stage=clamp(Math.floor(Math.max(0,age)/STEP_TIME),0,STEPS.length),blend=age<0?0:smooth((age-stage*STEP_TIME)/5.9);
  if(waiting)stage=STEPS.length;
  if(stage===STEPS.length)blend=0;
  const from=model.stages[stage],to=model.stages[Math.min(stage+1,STEPS.length)];
  // Commit the exact deduplicated topology as soon as vertices finish moving.
  const committed=blend===1,activeEdges=committed?to.edges:from.edges;
  const vertices=blend===0?from.vertices:blend===1?to.vertices:from.vertices.map((p,i)=>p.map((v,j)=>v+(to.vertices[i][j]-v)*blend));
  const phase=time>=END+EMPTY_HOLD?'reload':stage===STEPS.length?'retained':age<0?'registered':blend===1?'merged':'quantizing';
  return{model,vertices,activeEdges,edgeCount:activeEdges.length,stage,blend,phase,round,instanceRound,waiting,time,serial:instanceRound*5+model.index+1,step:STEPS[Math.min(stage,STEPS.length-1)],committed};
}
export function summary(frames){return{records:Math.max(...frames.map(f=>f.serial)),edges:frames.reduce((n,f)=>n+f.activeEdges.length,0),empty:frames.every(f=>f.activeEdges.length===0),round:frames[0]?.round||0,phase:frames.some(f=>f.phase==='reload')?'reload':frames.every(f=>f.phase==='retained')?'retained':frames.some(f=>f.phase==='quantizing')?'quantizing':'registered'};}
export function triangleArea(a,b,c){const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;}
