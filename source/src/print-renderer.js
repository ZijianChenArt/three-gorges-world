import {prepareArchive,instanceFrame,summary,triangleArea,random,archiveBundles} from './archive.js';
import {shadeFacet,hatchTriangle} from './materials.js';
const BOX_EDGES=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
export const MATERIAL_KINDS=['metal','matte','translucent','cut'];
export function automaticCamera(elapsed){return{yaw:Math.sin(elapsed*.025)*.28+Math.sin(elapsed*.011)*.13,pitch:Math.sin(elapsed*.019)*.10,zoom:1+Math.sin(elapsed*.013)*.04,panX:0,panY:0};}
export function project(p,camera={yaw:0,pitch:0}){const yaw=-.47+camera.yaw,tilt=.43+camera.pitch,x=p[0]*Math.cos(yaw)-p[2]*Math.sin(yaw),z=p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);return[x,z*Math.sin(tilt)-p[1]*Math.cos(tilt),z*Math.cos(tilt)+p[1]*Math.sin(tilt)];}
export function instancePose(instance,phone=false){
  const k=instance.key,s=instance.serial,angle=random(k,8)*Math.PI*2,r=2.1+random(k,9)*5;
  let position=[Math.cos(angle)*r,(random(k,10)-.5)*5.5,Math.sin(angle)*r],scale=1.4+random(k,11)*1.7;
  if(s===1){position=[-3.4,.4,4];scale=4.25;}else if(s===2){position=[3.8,1,-4];scale=2.65;}else if(s===3){position=[5.1,-1.9,3];scale=2.25;}
  if(phone){position=[position[0]*.51,position[1]*1.5+(Math.sin(angle)*1.7),position[2]*.83];scale*=s===1?.91:.82;}
  return{position,scale,angle:(random(k,12)-.5)*Math.PI*1.7,lean:(random(k,13)-.5)*.5};
}
export function transformPoint(p,pose){const ca=Math.cos(pose.angle),sa=Math.sin(pose.angle),cl=Math.cos(pose.lean),sl=Math.sin(pose.lean),x=p[0]*ca-p[2]*sa,z=p[0]*sa+p[2]*ca,y=p[1]*cl-z*sl,zz=p[1]*sl+z*cl;return[x,y,zz].map((v,i)=>v*pose.scale+pose.position[i]);}
export function getView(w,h){const phone=w<650,top=phone?142:110,bottom=phone?h-178:h-139,available=Math.max(120,bottom-top),scale=Math.min(w/(phone?14.7:25),available/(phone?17.8:16.2));return{scale,cx:w*(phone?.48:.515),cy:top+available*.5,top,bottom};}
export function placeLabelY(x,y,width,existing,min,max){for(let n=0;n<30;n++){const candidate=y+(n===0?0:(n%2?1:-1)*Math.ceil(n/2)*24);if(candidate<min||candidate>max)continue;if(!existing.some(p=>Math.abs(candidate-p.y)<23&&x<p.x+width&&x+width>p.x))return candidate;}return null;}
function box(bounds){return Array.from({length:8},(_,i)=>[(i&1?1:-1)*bounds[0],(i&2?1:-1)*bounds[1],(i&4?1:-1)*bounds[2]]);}
function normalOf(p){const a=p[1].map((v,i)=>v-p[0][i]),b=p[2].map((v,i)=>v-p[0][i]);return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
export class ArchivePrint{
  constructor(canvas,groups,faces=[]){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.models=prepareArchive(groups,faces);this.width=0;this.height=0;this.frames=[];this.camera={yaw:0,pitch:0,zoom:1,panX:0,panY:0};this.faceBudget=2100;}
  resize(w,h,dpr=1){this.width=w;this.height=h;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.ctx?.setTransform(dpr,0,0,dpr,0,0);}
  geometry(state){return state.instances.map(i=>instanceFrame(this.models[i.modelIndex],i,state.elapsed));}
  draw(state){
    const c=this.ctx;if(!c)return;const w=this.width,h=this.height,v=getView(w,h),phone=w<650,frames=this.geometry(state),s=summary(frames,state);this.frames=frames;this.summary=s;this.view=v;
    c.globalAlpha=1;c.fillStyle='#f5f3ec';c.fillRect(0,0,w,h);v.scale*=this.camera.zoom;v.cx+=this.camera.panX*w;v.cy+=this.camera.panY*h;
    const pos=p=>{const q=project(p,this.camera);return[v.cx+q[0]*v.scale,v.cy+q[1]*v.scale,q[2]];};
    const line=(a,b)=>{c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);};
    const prepared=frames.map(f=>{const pose=instancePose(f.instance,phone),world=f.vertices.map(p=>transformPoint(p,pose)),points=world.map(pos),corners=box(f.model.bounds).map(p=>pos(transformPoint(p,pose)));return{...f,pose,world,points,corners,material:MATERIAL_KINDS[f.instance.materialIndex]};});
    c.save();c.beginPath();c.rect(0,v.top-30,w,v.bottom-v.top+55);c.clip();
    // Bounded proxy bundles retain exact closed-record ranges and counts, never hidden live meshes.
    const bundles=archiveBundles(state,phone?28:64);this.bundleCount=bundles.length;this.bundleRecords=bundles.reduce((n,b)=>n+b.count,0);
    for(let i=0;i<bundles.length;i++){
      const b=bundles[i],columns=phone?4:8,row=Math.floor(i/columns),x=(i%columns-(columns-1)/2)*(phone?2.2:2.35),origin=[x,3.2-row*.78,-7.8-row*.58],size=.47+Math.min(.22,Math.log2(b.count+1)*.05);
      c.strokeStyle='#bdbab1';c.lineWidth=.45;c.setLineDash([]);c.beginPath();const p=box([size,size*.73,size*.5]).map(q=>pos(q.map((v,j)=>v+origin[j])));for(const[a,d]of BOX_EDGES)line(p[a],p[d]);c.stroke();
      if(b.count>1&&(i%3===0||i===bundles.length-1)){const p=pos(origin);c.fillStyle='#87847c';c.font=`${phone?7:8}px 'Courier New',monospace`;c.fillText(`×${b.count}`,p[0],p[1]);}
    }
    for(const f of prepared){c.strokeStyle=f.phase==='retained'?'#a09d94':'#c5c2b9';c.lineWidth=.5;c.setLineDash([2,4]);c.beginPath();for(const[a,b]of BOX_EDGES)line(f.corners[a],f.corners[b]);c.stroke();}c.setLineDash([]);
    const triangles=[],facetLimit=Math.max(42,Math.floor(Math.min(this.faceBudget,phone?980:2400)/Math.max(1,frames.length)));
    const yaw=-.47+this.camera.yaw,tilt=.43+this.camera.pitch,view=[Math.sin(yaw)*Math.cos(tilt),Math.sin(tilt),Math.cos(yaw)*Math.cos(tilt)];
    for(const f of prepared){const stride=Math.max(1,Math.ceil(f.model.faces.length/facetLimit));for(let fi=f.instance.serial%stride;fi<f.model.faces.length;fi+=stride){const face=f.model.faces[fi],local=face.map(i=>f.vertices[i]);if(triangleArea(...local)<.00002)continue;const world=face.map(i=>f.world[i]),normal=normalOf(world),localNormal=normalOf(local);if(Math.abs(localNormal[1])/(Math.hypot(...localNormal)||1)>.78)continue;const q=face.map(i=>f.points[i]),center=world[0].map((v,j)=>(v+world[1][j]+world[2][j])/3),style=shadeFacet({material:f.material,normal,view,center,elapsed:state.elapsed,seed:f.instance.key});triangles.push({q,world,local,style,material:f.material,depth:q.reduce((n,p)=>n+p[2],0)/3,fi,frame:f});}}
    triangles.sort((a,b)=>a.depth-b.depth);this.facetCount=triangles.length;this.hatchCount=0;
    for(const t of triangles){c.globalAlpha=t.style.alpha;c.fillStyle=t.style.fill;c.beginPath();c.moveTo(...t.q[0].slice(0,2));c.lineTo(...t.q[1].slice(0,2));c.lineTo(...t.q[2].slice(0,2));c.closePath();c.fill();c.globalAlpha=1;
      if(t.material==='cut'&&t.fi%3===0){const segments=hatchTriangle(t.q.map(p=>p.slice(0,2)),{sourceTriangle:t.local,spacing:phone?.085:.065,maxSegments:5,seed:t.frame.instance.key});c.globalAlpha=.48;c.strokeStyle='#242422';c.lineWidth=.48;c.beginPath();for(const[a,b]of segments)line(a,b);c.stroke();this.hatchCount+=segments.length;c.globalAlpha=1;}
      if(t.material==='metal'&&t.style.highlightAlpha>.12){c.globalAlpha=t.style.highlightAlpha;c.strokeStyle=t.style.highlight;c.lineWidth=phone?.75:1;c.beginPath();line(t.q[0],t.q[1]);c.stroke();c.globalAlpha=1;}
    }
    for(const f of prepared){const metal=f.material==='metal',glass=f.material==='translucent';c.strokeStyle=glass?'#7e827f':metal?'#202321':'#22221f';c.lineWidth=glass?.52:metal?.72:phone?.64:.66;c.globalAlpha=glass?.6:1;c.beginPath();for(const[a,b]of f.activeEdges)line(f.points[a],f.points[b]);c.stroke();c.globalAlpha=1;
      // Actual intersections with the surviving mesh form the moving inspection cut.
      if(f.edgeCount&&f.material==='cut'){const cut=-f.model.bounds[1]+2*f.model.bounds[1]*(.5+.5*Math.sin(f.time*.17));c.fillStyle='#171714';for(const[a,b]of f.activeEdges){const p=f.vertices[a],q=f.vertices[b];if((p[1]-cut)*(q[1]-cut)<0){const t=(cut-p[1])/(q[1]-p[1]),hit=pos(transformPoint(p.map((v,j)=>v+(q[j]-v)*t),f.pose));c.fillRect(hit[0]-1,hit[1]-1,2,2);}}}
    }
    c.restore();c.globalAlpha=1;this.labels=[];
    for(const f of prepared){const p=f.corners.reduce((a,b)=>a[1]<b[1]?a:b),x=Math.max(18,Math.min(w-(phone?111:151),p[0]+9)),initialY=Math.max(v.top-20,Math.min(v.bottom-5,p[1]-10)),y=placeLabelY(x,initialY,phone?110:146,this.labels,v.top-20,v.bottom-5);if(y===null)continue;
      c.strokeStyle='#1b1b17';c.lineWidth=.6;c.beginPath();line(p,[x,y+3]);line([x-3,y],[x+3,y]);c.stroke();c.fillStyle='#f5f3ec';c.fillRect(x+5,y-12,phone?105:143,phone?20:24);c.fillStyle='#191916';c.font=`${phone?10:10.5}px 'Courier New',monospace`;c.fillText(`A—${String(f.serial).padStart(3,'0')} / ${f.edgeCount}`,x+8,y);if(!phone){c.font="7px 'Courier New',monospace";c.fillStyle='#65635c';c.fillText(f.material.toUpperCase(),x+8,y+10);}this.labels.push({x,y,id:f.model.id,serial:f.serial});
    }
    c.fillStyle='#77746b';c.font="8px 'Courier New',monospace";c.fillText(`PRESENT ${s.visible} / ARCHIVED ${s.closed} / BUNDLES ${bundles.length}`,20,v.bottom+8);
    c.strokeStyle='#1b1b17';c.lineWidth=.7;for(const[x,y]of[[17,v.top-25],[w-17,v.top-25],[17,v.bottom+18],[w-17,v.bottom+18]]){c.beginPath();line([x-4,y],[x+4,y]);line([x,y-4],[x,y+4]);c.stroke();}
  }
}
