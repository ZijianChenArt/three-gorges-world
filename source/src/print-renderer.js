import {prepareArchive,frameFor,summary,INTRO,STEP_TIME,STEPS,triangleArea,random} from './archive.js';
const BOX_EDGES=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
const PLACEMENTS=[[-4.4,1.3,4.8],[3.8,.6,-5.2],[7.1,.9,1.2],[-6.4,-1.2,-4.4],[2.1,-2.5,4.1]];
const SCALES=[4.9,2.25,2.3,2.3,3.0];
const labels=['MEMORY APERTURE','RESONANCE GARDEN','DATA CLOUD','ECHO CHAMBER','PHASE BLOOM'];
export function automaticCamera(elapsed){return{yaw:Math.sin(elapsed*.025)*.28+Math.sin(elapsed*.011)*.13,pitch:Math.sin(elapsed*.019)*.10,zoom:1+Math.sin(elapsed*.013)*.04,panX:0,panY:0};}
export function project(p,camera={yaw:0,pitch:0}){const yaw=-.47+camera.yaw,tilt=.43+camera.pitch,x=p[0]*Math.cos(yaw)-p[2]*Math.sin(yaw),z=p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);return[x,z*Math.sin(tilt)-p[1]*Math.cos(tilt),z*Math.cos(tilt)+p[1]*Math.sin(tilt)];}
export function instancePose(index,round=0){const seed=937+round*1901+index*7919;return{scale:SCALES[index]*(round===0?1:.8+random(seed,0)*.4),angle:round===0?[.22,-.38,.44,-.19,.63][index]:(random(seed,1)-.5)*Math.PI*1.3,lean:round===0?0:(random(seed,2)-.5)*.3,position:PLACEMENTS[index].map((v,k)=>v+(round===0?0:(random(seed,k+3)-.5)*1.7))};}
export function worldPoint(model,p,round=0,phone=false){const pose=instancePose(model.index,round);if(phone){const placements=[[-1.8,3.1,2],[2.4,3.8,-4.3],[2,.1,1.8],[-2.7,-.5,-3.5],[.4,-3.9,3.5]];pose.position=placements[model.index].map((v,k)=>v+(round===0?0:(random(937+round*1901+model.index*7919,k+3)-.5)*.8));pose.scale*=model.index===0?.91:.87;}const ca=Math.cos(pose.angle),sa=Math.sin(pose.angle),cl=Math.cos(pose.lean),sl=Math.sin(pose.lean),x=p[0]*ca-p[2]*sa,z=p[0]*sa+p[2]*ca,y=p[1]*cl-z*sl,zz=p[1]*sl+z*cl;return[x,y,zz].map((v,i)=>v*pose.scale+pose.position[i]);}
export function getView(w,h){const phone=w<650,top=phone?142:110,bottom=phone?h-178:h-139,available=Math.max(120,bottom-top),scale=Math.min(w/(phone?14.7:25),available/(phone?17.8:16.2));return{scale,cx:w*(phone?.48:.515),cy:top+available*.5,top,bottom};}
export function placeLabelY(x,y,width,existing,min,max){for(let n=0;n<20;n++){const candidate=y+(n===0?0:(n%2?1:-1)*Math.ceil(n/2)*26);if(candidate<min||candidate>max)continue;if(!existing.some(p=>Math.abs(candidate-p.y)<25&&x<p.x+width&&x+width>p.x))return candidate;}return y;}
function box(model){const b=model.bounds;return Array.from({length:8},(_,i)=>[(i&1?1:-1)*b[0],(i&2?1:-1)*b[1],(i&4?1:-1)*b[2]]);}
export class ArchivePrint{
  constructor(canvas,groups,faces=[]){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.models=prepareArchive(groups,faces);this.width=0;this.height=0;this.frames=[];this.camera={yaw:0,pitch:0,zoom:1,panX:0,panY:0};}
  resize(w,h,dpr=1){this.width=w;this.height=h;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.ctx?.setTransform(dpr,0,0,dpr,0,0);}
  geometry(state){return this.models.map(m=>frameFor(m,state.elapsed));}
  draw(state){const c=this.ctx;if(!c)return;const w=this.width,h=this.height,v=getView(w,h),phone=w<650,frames=this.geometry(state),s=summary(frames);this.frames=frames;this.summary=s;this.view=v;
    c.fillStyle='#f5f3ec';c.fillRect(0,0,w,h);
    v.scale*=this.camera.zoom;v.cx+=this.camera.panX*w;v.cy+=this.camera.panY*h;
    const pos=p=>{const q=project(p,this.camera);return[v.cx+q[0]*v.scale,v.cy+q[1]*v.scale,q[2]];};
    const local=(m,p,round=frames[m.index].instanceRound)=>pos(worldPoint(m,p,round,phone));
    const line=(a,b)=>{c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);};
    // The registry frames survive independently of the model geometry.
    c.save();c.beginPath();c.rect(0,v.top-30,w,v.bottom-v.top+60);c.clip();
    if(s.round>0){c.strokeStyle='#d9d6cc';c.lineWidth=.5;c.beginPath();for(const m of this.models){const points=box(m).map(p=>local(m,p,s.round-1));for(const[a,b]of BOX_EDGES)line([points[a][0]-13,points[a][1]-13],[points[b][0]-13,points[b][1]-13]);}c.stroke();}
    for(const m of this.models){const points=box(m).map(p=>local(m,p));c.strokeStyle='#b9b6ae';c.lineWidth=.55;c.setLineDash([2,4]);c.beginPath();for(const[a,b]of BOX_EDGES)line(points[a],points[b]);c.stroke();c.setLineDash([]);}
    // Filled marks are original triangles only; no invented convex caps or hole filling.
    const triangles=[];
    for(const f of frames)for(const face of f.model.faces){const p=face.map(i=>f.vertices[i]);if(triangleArea(...p)<.00002)continue;const q=p.map(v=>local(f.model,v)),a=p[1].map((v,i)=>v-p[0][i]),b=p[2].map((v,i)=>v-p[0][i]),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      // A fixed incident direction prints only facets turned toward it.
      if(Math.abs(normal[1])/(Math.hypot(...normal)||1)>.68)continue;
      const light=(normal[0]*.35+normal[1]*.83-normal[2]*.42)/(Math.hypot(...normal)||1);if(light<.24)continue;triangles.push({p:q,depth:q.reduce((n,p)=>n+p[2],0)/3,shade:light>.75?'#11110f':light>.5?'#44443f':'#b3b0a7'});}
    triangles.sort((a,b)=>a.depth-b.depth);for(const t of triangles){c.fillStyle=t.shade;c.beginPath();c.moveTo(...t.p[0].slice(0,2));c.lineTo(...t.p[1].slice(0,2));c.lineTo(...t.p[2].slice(0,2));c.closePath();c.fill();}
    for(const f of frames){const m=f.model;c.strokeStyle='#151512';c.lineWidth=phone?.66:.72;c.beginPath();for(const[a,b]of f.activeEdges)line(local(m,f.vertices[a]),local(m,f.vertices[b]));c.stroke();
      // A real plane-section through surviving edges, showing the current inspection cut.
      if(f.phase==='quantizing'||f.phase==='registered'){const progress=f.phase==='registered'?Math.min(1,f.time/INTRO):f.blend,cut=-m.bounds[1]+2*m.bounds[1]*progress,intersections=[];
        for(const[a,b]of f.activeEdges){const p=f.vertices[a],q=f.vertices[b];if((p[1]-cut)*(q[1]-cut)<0){const t=(cut-p[1])/(q[1]-p[1]);intersections.push(p.map((v,i)=>v+(q[i]-v)*t));}}
        c.fillStyle='#111';for(const p of intersections){const q=local(m,p);c.fillRect(q[0]-.6,q[1]-.6,1.2,1.2);}
      }
    }
    c.restore();
    // IDs remain fixed to each source bounding volume, including the empty end state.
    this.labels=[];
    for(const f of frames){const m=f.model,points=box(m).map(p=>local(m,p)),p=points.reduce((a,b)=>a[1]<b[1]?a:b),x=Math.max(18,Math.min(w-(phone?111:156),p[0]+9)),initialY=Math.max(v.top-20,Math.min(v.bottom+18,p[1]-10)),y=placeLabelY(x,initialY,phone?110:154,this.labels,v.top-20,v.bottom+18);
      c.strokeStyle='#1b1b17';c.lineWidth=.6;c.beginPath();line(p,[x,y+3]);line([x-4,y],[x+4,y]);line([x,y-4],[x,y+4]);c.stroke();c.fillStyle='#f5f3ec';c.fillRect(x+6,y-12,phone?104:148,phone?21:25);c.fillStyle='#191916';c.font=`${phone?10.5:11}px 'Courier New',monospace`;c.fillText(`A—${String(f.serial).padStart(3,'0')} / ${String(f.edgeCount).padStart(4,'0')}`,x+9,y);c.font=`${phone?6:7}px 'Courier New',monospace`;c.fillStyle='#66645e';if(!phone)c.fillText(labels[m.index],x+9,y+11);this.labels.push({x,y,id:m.id});
    }
    c.fillStyle='#77746b';c.font=`8px 'Courier New',monospace`;c.fillText(`SOURCE REGISTER / ${String(s.round+1).padStart(3,'0')}`,20,v.bottom-4);
    if(s.round>0)c.fillText(`PREVIOUS ACCEPTANCE: ${String(s.round).padStart(3,'0')} — 5 RECORDS / 0 EDGES`,20,v.bottom+7);
    c.strokeStyle='#1b1b17';c.lineWidth=.7;for(const[x,y]of[[17,v.top-25],[w-17,v.top-25],[17,v.bottom+4],[w-17,v.bottom+4]]){c.beginPath();line([x-4,y],[x+4,y]);line([x,y-4],[x,y+4]);c.stroke();}
  }
}
