import { terrainHeight, positionOf } from './simulation.js';
const YAW = -.44, TILT = .58;
const cy=Math.cos(YAW),sy=Math.sin(YAW),ct=Math.cos(TILT),st=Math.sin(TILT);
export function project(x,y,z,view){const rx=x*cy-z*sy,depth=x*sy+z*cy;return{x:view.cx+rx*view.scale,y:view.cy+(depth*st-y*ct)*view.scale,depth:depth*ct+y*st};}
export function unprojectDelta(dx,dy,scale){const rx=dx/scale,depth=dy/scale/st;return{x:rx*cy+depth*sy,z:-rx*sy+depth*cy};}
export function deformGround(x,z,state){let sx=0,sz=0,weight=.8;for(const p of state.pieces){const pos=positionOf(p,state),w=Math.exp(-((x-p.x)**2+(z-p.z)**2)/21);sx+=(pos.x-p.x)*w;sz+=(pos.z-p.z)*w;weight+=w;}return[x+sx/weight,terrainHeight(x,z),z+sz/weight];}
function segmentDistance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
export class Landscape{
  constructor(canvas,models=[]){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.models=models;this.hits=[];this.width=0;this.height=0;}
  resize(width,height,dpr=1){this.width=width;this.height=height;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.ctx?.setTransform(dpr,0,0,dpr,0,0);const phone=width<650,landscape=height<530;this.view={cx:width*(phone?.5:.57),cy:height*(phone?.42:landscape?.53:.52),scale:Math.min(width/(phone?29:35),height/(phone?22:landscape?23:22))};}
  path(points,close=false){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));if(close)c.closePath();}
  worldLine(points,color,width=.6){this.path(points.map(p=>project(...p,this.view)));this.ctx.strokeStyle=color;this.ctx.lineWidth=width;this.ctx.stroke();}
  drawModel(model,x,z,color,width=0.65,collect=false){
    const c=this.ctx,v=this.view,edges=model.edges,base=terrainHeight(x,z);const segments=[];let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    c.beginPath();
    for(let i=0;i<edges.length;i+=6){const a=project(x+edges[i],base+edges[i+1],z+edges[i+2],v),b=project(x+edges[i+3],base+edges[i+4],z+edges[i+5],v);c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);if(collect){segments.push([a,b]);minX=Math.min(minX,a.x,b.x);minY=Math.min(minY,a.y,b.y);maxX=Math.max(maxX,a.x,b.x);maxY=Math.max(maxY,a.y,b.y);}}
    c.strokeStyle=color;c.lineWidth=width;c.stroke();return{segments,bounds:{minX,minY,maxX,maxY}};
  }
  draw(state,hover=null,keyboard=false){
    const c=this.ctx;if(!c)return;const{width:w,height:h,view:v}=this;c.fillStyle='#fafafa';c.fillRect(0,0,w,h);this.hits=[];
    // One fixed datum and a deformable ground shared by all five sculptures.
    const datum=v.cy+v.scale*1.8;c.strokeStyle='#bfbfbf';c.lineWidth=.6;c.beginPath();c.moveTo(0,datum);c.lineTo(w,datum);c.stroke();
    c.fillStyle='#737373';c.font='8px ui-monospace, monospace';c.fillText('原位 / DATUM',w<650?22:w-105,datum-8);
    for(let axis=0;axis<2;axis++)for(let j=-12;j<=12;j++){
      const points=[];for(let i=-16;i<=16;i++){const x=axis?j:i*.8,z=axis?i*.62:j*.72;const p=deformGround(x,z,state);points.push(p);}
      this.worldLine(points,j%4===0?'#b4b4b4':'#d1d1d1',j%4===0?.62:.48);
    }
    const sorted=state.pieces.map(p=>({p,pos:positionOf(p,state)})).sort((a,b)=>project(a.pos.x,0,a.pos.z,v).depth-project(b.pos.x,0,b.pos.z,v).depth);
    // Four sparse links: keeping one work stretches its relation to the others.
    for(const [a,b]of[[1,0],[0,2],[1,3],[2,4]]){const pa=positionOf(state.pieces[a],state),pb=positionOf(state.pieces[b],state);this.worldLine([[pa.x,.15,pa.z],[pb.x,.15,pb.z]],'#a4a4a4',.65);}
    for(const{p,pos}of sorted){
      if(!this.models[p.id])continue;const d=Math.hypot(pos.x-p.x,pos.z-p.z);
      if(d>.2){this.drawModel(this.models[p.id],p.x,p.z,p.moved?'#c1c1c1':'#e0e0e0',.5);if(p.moved||state.held===p.id){c.setLineDash([2,5]);this.worldLine([[p.x,.04,p.z],[pos.x,.04,pos.z]],'#777777',.75);c.setLineDash([]);const origin=project(p.x,0,p.z,v);c.fillStyle='#5f5f5f';c.fillRect(origin.x-2,origin.y-2,4,4);}}
    }
    for(const{p,pos}of sorted){
      const model=this.models[p.id];if(!model)continue;const held=state.held===p.id,focus=hover===p.id||(keyboard&&state.selected===p.id);
      const hit=this.drawModel(model,pos.x,pos.z,held?'#060606':focus?'#111111':'#3f3f3f',held?1.05:focus?.92:.67,true);
      const center=project(pos.x,terrainHeight(pos.x,pos.z),pos.z,v);this.hits.push({id:p.id,...hit,center});
      c.font=`${w<650?8:9}px ui-monospace, monospace`;c.fillStyle=held||focus?'#161616':'#7a7a7a';const label=`0${p.id+1}${held?' / 暂留':focus?' / '+p.label:''}`;c.fillText(label,center.x+7,hit.bounds.maxY+14);
      if(held||focus){const b=hit.bounds,pad=5;c.strokeStyle='#3d3d3d';c.lineWidth=.7;c.beginPath();for(const[x,y,sx,sy]of[[b.minX-pad,b.minY-pad,1,1],[b.maxX+pad,b.minY-pad,-1,1],[b.minX-pad,b.maxY+pad,1,-1],[b.maxX+pad,b.maxY+pad,-1,-1]]){c.moveTo(x,y+7*sy);c.lineTo(x,y);c.lineTo(x+7*sx,y);}c.stroke();}
    }
    c.strokeStyle='#616161';c.lineWidth=.6;for(const[x,y]of[[22,83],[w-22,83],[22,h-98],[w-22,h-98]]){c.beginPath();c.moveTo(x-4,y);c.lineTo(x+4,y);c.moveTo(x,y-4);c.lineTo(x,y+4);c.stroke();}
  }
  hit(x,y){
    let best=null,distance=Infinity;
    for(let i=this.hits.length-1;i>=0;i--){const hit=this.hits[i],b=hit.bounds;if(x<b.minX-16||x>b.maxX+16||y<b.minY-16||y>b.maxY+18)continue;let d=Infinity;for(const[a,b]of hit.segments)d=Math.min(d,segmentDistance(x,y,a,b));if(d<distance){distance=d;best=hit.id;}}
    return distance<25?best:null;
  }
}
