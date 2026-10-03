import {prepareModels,makeTraits,edgeFrame,applyInteractions} from './simulation.js';
import {prepareEffects,materialEffects,depthStyle} from './effects.js';
export function projectRaw(x,y,z,elapsed=0,camera={yaw:0,pitch:0}){
  const yaw=-.2+camera.yaw+Math.sin(elapsed*.021)*.07,tilt=.34+camera.pitch+Math.sin(elapsed*.017)*.026;
  const rx=x*Math.cos(yaw)-z*Math.sin(yaw),depth=x*Math.sin(yaw)+z*Math.cos(yaw),d=depth*Math.cos(tilt)+y*Math.sin(tilt),perspective=1+d*.007;
  return[rx*perspective,(depth*Math.sin(tilt)-y*Math.cos(tilt))*perspective,d];
}
export function fittedView(width,height,bounds,camera={zoom:1,panX:0,panY:0}){const phone=width<650,top=phone?96:86,bottom=height-(phone?246:200),stageHeight=Math.max(140,bottom-top),scale=Math.min((width-(phone?26:80))/(bounds.maxX-bounds.minX||1),stageHeight/(bounds.maxY-bounds.minY||1))*camera.zoom;return{scale,cx:width/2-(bounds.minX+bounds.maxX)*scale/2+camera.panX*width,cy:top+stageHeight/2-(bounds.minY+bounds.maxY)*scale/2+camera.panY*height};}
export class Formation{
  constructor(canvas,groups){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.models=prepareModels(groups);this.prepared=this.models.map(prepareEffects);this.width=0;this.height=0;this.traits=[];this.keys=[];this.lastBounds=null;this.camera={yaw:0,pitch:0,zoom:1,panX:0,panY:0};this.hits=[];}
  resize(width,height,dpr=1){this.width=width;this.height=height;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.ctx?.setTransform(dpr,0,0,dpr,0,0);}
  geometry(state){
    const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity},paths=[],curves=[];
    const include=p=>{bounds.minX=Math.min(bounds.minX,p[0]);bounds.maxX=Math.max(bounds.maxX,p[0]);bounds.minY=Math.min(bounds.minY,p[1]);bounds.maxY=Math.max(bounds.maxY,p[1]);return p;};
    const project=p=>include(projectRaw(...p,state.elapsed,this.camera));
    const groups=this.models.map(model=>{
      const score=state.scores[model.index];if(this.keys[model.index]!==score.key){this.keys[model.index]=score.key;this.traits[model.index]=Array.from({length:model.edges.length/6},(_,e)=>makeTraits(score,e));}
      const points=new Float32Array(model.edges.length/6*9),world=new Float32Array(model.edges.length);
      for(let e=0;e<model.edges.length/6;e++){const q=applyInteractions(edgeFrame(model,score,state.elapsed,e,this.traits[model.index][e]),model,state,e),a=project(q.slice(0,3)),b=project(q.slice(3,6)),i=e*9;points.set([...a,...b,q[6],q[7],q[8]],i);world.set(q.slice(0,6),e*6);}
      const extra=materialEffects(model,score,state.elapsed,this.traits[model.index],this.prepared[model.index]);
      for(const p of extra.paths)paths.push({...p,alpha:p.alpha*(1-state.gathers[model.index].value),points:p.points.map(project)});
      for(const p of extra.curves)curves.push({...p,alpha:p.alpha*(1-state.gathers[model.index].value),start:project(p.start),control:project(p.control),end:project(p.end)});
      return{points,world,index:model.index,material:score.material};
    });
    for(const pulse of state.pulses){const age=state.interactionTime-pulse.started,points=[],radius=state.reducedMotion?.7:.15+age*5;if(state.reducedMotion&&age>.7)continue;for(let j=0;j<=64;j++){const a=j/64*Math.PI*2;points.push(projectRaw(pulse.point[0]+Math.cos(a)*radius,pulse.point[1],pulse.point[2]+Math.sin(a)*radius,state.elapsed,this.camera));}paths.push({points,alpha:.16*Math.max(0,1-age/2.8),width:.65,kind:'ripple'});}
    return{groups,paths,curves,bounds};
  }
  draw(state){
    const c=this.ctx;if(!c)return;const{width:w,height:h}=this;c.fillStyle='#fafafa';c.fillRect(0,0,w,h);
    const{groups,paths,curves,bounds}=this.geometry(state),v=fittedView(w,h,bounds,this.camera);this.hits=[];this.lastBounds=bounds;this.view=v;
    const pos=p=>[v.cx+p[0]*v.scale,v.cy+p[1]*v.scale];
    for(const p of paths){c.strokeStyle=`rgba(15,15,15,${p.alpha.toFixed(3)})`;c.lineWidth=p.width;c.beginPath();for(let i=0;i<p.points.length;i++){const q=pos(p.points[i]);if(i)c.lineTo(...q);else c.moveTo(...q);}c.stroke();}
    for(const p of curves){c.strokeStyle=`rgba(15,15,15,${p.alpha.toFixed(3)})`;c.lineWidth=p.width;c.beginPath();c.moveTo(...pos(p.start));c.quadraticCurveTo(...pos(p.control),...pos(p.end));c.stroke();}
    const lines=Array.from({length:3},()=>Array.from({length:32},()=>[])),dots=Array.from({length:12},()=>[]);
    for(const group of groups)for(let i=0;i<group.points.length;i+=9){const p=group.points,depth=(p[i+2]+p[i+5])/2,d=depthStyle(depth),layer=depth<-3?0:depth>3?2:1,x1=v.cx+p[i]*v.scale,y1=v.cy+p[i+1]*v.scale,x2=v.cx+p[i+3]*v.scale,y2=v.cy+p[i+4]*v.scale;
      lines[layer][Math.min(31,Math.round(p[i+6]*d.opacity*31))].push(x1,y1,x2,y2);
      if(p[i+6]>.06||p[i+7]>.08){const wi=i/9*6;this.hits.push({id:group.index,a:[x1,y1],b:[x2,y2],point:[0,1,2].map(k=>(group.world[wi+k]+group.world[wi+3+k])/2)});}
      if(p[i+7]>.02)dots[Math.min(11,Math.round(p[i+7]*d.opacity*23))].push(x1,y1,x2,y2,p[i+8]*d.pointScale);
    }
    for(let layer=0;layer<3;layer++){c.lineWidth=[.43,.64,.86][layer]*(w<650?.9:1);for(let b=1;b<32;b++){const data=lines[layer][b];if(!data.length)continue;c.strokeStyle=`rgba(15,15,15,${(b/31).toFixed(3)})`;c.beginPath();for(let i=0;i<data.length;i+=4){c.moveTo(data[i],data[i+1]);c.lineTo(data[i+2],data[i+3]);}c.stroke();}}
    for(let b=1;b<12;b++){const data=dots[b];if(!data.length)continue;c.fillStyle=`rgba(15,15,15,${(b/23).toFixed(3)})`;c.beginPath();for(let i=0;i<data.length;i+=5){const r=data[i+4];c.moveTo(data[i]+r,data[i+1]);c.arc(data[i],data[i+1],r,0,Math.PI*2);c.moveTo(data[i+2]+r,data[i+3]);c.arc(data[i+2],data[i+3],r,0,Math.PI*2);}c.fill();}
    c.strokeStyle='#909090';c.lineWidth=.6;for(const[x,y]of[[23,75],[w-23,75],[23,h-83],[w-23,h-83]]){c.beginPath();c.moveTo(x-3,y);c.lineTo(x+3,y);c.moveTo(x,y-3);c.lineTo(x,y+3);c.stroke();}
  }
  pick(x,y){let best=null,nearest=22;for(const h of this.hits){const dx=h.b[0]-h.a[0],dy=h.b[1]-h.a[1],t=Math.max(0,Math.min(1,((x-h.a[0])*dx+(y-h.a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-h.a[0]-t*dx,y-h.a[1]-t*dy);if(d<nearest){nearest=d;best=h;}}return best;}

}
