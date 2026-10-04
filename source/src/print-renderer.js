import {prepareArchive,instanceFrame,summary,triangleArea,random,archiveBundles} from './archive.js';
import {shadeFacet,hatchTriangle,MATERIAL_KINDS} from './materials.js';
import {automaticCamera,project,createProjector} from './flight-camera.js';
import {deformRipplePoint,hasRipple} from './ripple.js';
import {pickProjected} from './picking.js';
import {applyPulseTint} from './chromatic-pulse.js';
import {sampleEdgeField} from './edge-field.js';
import {patchIndex,phaseInfo} from './surface-patches.js';
import {createGeometryClipper,clipSegmentToViewport,triangulateClippedPolygon} from './clipping.js';
export {automaticCamera,project};
const BOX_EDGES=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
export {MATERIAL_KINDS};
export function instancePose(instance,phone=false,{elapsed=0,reducedMotion=false}={}){
  const k=instance.key,s=instance.serial,angle=random(k,8)*Math.PI*2,r=2.6+random(k,9)*7;
  let position=[Math.cos(angle)*r,(random(k,10)-.5)*6.4,Math.sin(angle)*r],scale=1.3+random(k,11)*1.55;
  if(s===1){position=[-3.4,.4,4];scale=4.25;}else if(s===2){position=[3.8,1,-4];scale=2.65;}else if(s===3){position=[5.1,-1.9,3];scale=2.25;}
  if(instance.modelIndex===5){
    // Five opening size bands guarantee small, medium and occasional large
    // cubes; every actual size and depth is still stable for the intake seed.
    const band=s>=6&&s<=10?[.1,.55,.9,.3,.7][s-6]:random(k,41),size=random(k,42);
    scale=band<.5?.3+size*.3:band<.85?.65+size*.35:1.1+size*.4;
    const cubeAngle=random(k,43)*Math.PI*2,cubeRadius=3+random(k,44)*6;
    position=[Math.cos(cubeAngle)*cubeRadius,(random(k,45)-.5)*7.6,-1+Math.sin(cubeAngle)*cubeRadius*.82];
  }
  if(phone){position=[position[0]*.51,position[1]*1.5+(Math.sin(angle)*1.7),position[2]*.83];scale*=instance.modelIndex===5?1:s===1?.91:.82;}
  const age=reducedMotion?0:Math.max(0,elapsed-(instance.poseStarted??instance.started??0)),t=age-5*(1-Math.exp(-age/5)),phase=random(k,31)*Math.PI*2;
  const drift=(axis,rate,amount)=>amount*(Math.sin(t*rate+phase+axis)-Math.sin(phase+axis));
  position=position.map((v,axis)=>v+drift(axis,.024+random(k,32+axis)*.022,(phone?.14:.2)));
  return{position,scale,angle:(random(k,12)-.5)*Math.PI*1.7+(random(k,35)>.5?1:-1)*(.002+random(k,36)*.003)*t,lean:(random(k,13)-.5)*.5+drift(1,.031,.038),roll:drift(2,.027,.035)};
}
export function transformPoint(p,pose){const ca=Math.cos(pose.angle),sa=Math.sin(pose.angle),cl=Math.cos(pose.lean),sl=Math.sin(pose.lean),x=p[0]*ca-p[2]*sa,z=p[0]*sa+p[2]*ca,y=p[1]*cl-z*sl,zz=p[1]*sl+z*cl;const cr=Math.cos(pose.roll||0),sr=Math.sin(pose.roll||0);return[x*cr-y*sr,x*sr+y*cr,zz].map((v,i)=>v*pose.scale+pose.position[i]);}
export function getView(w,h){const phone=w<650,top=phone?36:31,bottom=h-53,available=Math.max(120,bottom-top),scale=Math.min(w/(phone?14.7:25),available/(phone?17.8:16.2));return{scale,cx:w*(phone?.48:.515),cy:top+available*.5,top,bottom};}
export function placeLabelY(x,y,width,existing,min,max){for(let n=0;n<30;n++){const candidate=y+(n===0?0:(n%2?1:-1)*Math.ceil(n/2)*24);if(candidate<min||candidate>max)continue;if(!existing.some(p=>Math.abs(candidate-p.y)<23&&x<p.x+width&&x+width>p.x))return candidate;}return null;}
function box(bounds){return Array.from({length:8},(_,i)=>[(i&1?1:-1)*bounds[0],(i&2?1:-1)*bounds[1],(i&4?1:-1)*bounds[2]]);}
function normalOf(p){const a=p[1].map((v,i)=>v-p[0][i]),b=p[2].map((v,i)=>v-p[0][i]);return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
export class ArchivePrint{
  constructor(canvas,groups,faces=[],{overlayOnly=false}={}){this.canvas=canvas;this.overlayOnly=overlayOnly;this.ctx=canvas.getContext('2d',{alpha:overlayOnly});this.models=prepareArchive(groups,faces);this.width=0;this.height=0;this.frames=[];this.camera={yaw:0,pitch:0,zoom:1,panX:0,panY:0};this.faceBudget=2100;}
  resize(w,h,dpr=1){if(this.width===w&&this.height===h&&this.dpr===dpr)return false;this.width=w;this.height=h;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.ctx?.setTransform(dpr,0,0,dpr,0,0);}
  geometry(state){return state.instances.map(i=>instanceFrame(this.models[i.modelIndex],i,state.elapsed,{coordinates:true}));}
  draw(state){
    const c=this.ctx;if(!c)return;const w=this.width,h=this.height,v=getView(w,h),phone=w<650,frames=this.geometry(state),s=summary(frames,state);this.frames=frames;this.summary=s;this.view=v;
    c.globalAlpha=1;if(this.overlayOnly)c.clearRect(0,0,w,h);else{c.fillStyle='#ffffff';c.fillRect(0,0,w,h);}v.scale*=this.camera.zoom;v.cx+=this.camera.panX*w;v.cy+=this.camera.panY*h;
    const projectFrame=createProjector(this.camera);
    const pos=p=>{const q=projectFrame(p),screen=[v.cx+q[0]*v.scale,v.cy+q[1]*v.scale,q[2]];screen.visible=q.visible!==false;screen.cameraDepth=q.cameraDepth;screen.multiplier=q.multiplier;return screen;};
    const clipper=createGeometryClipper(this.camera,v,w,h);
    const line=(a,b)=>{const clipped=clipSegmentToViewport(a,b,w,h);if(!clipped)return false;c.moveTo(...clipped[0]);c.lineTo(...clipped[1]);return true;};
    const worldLine=(a,b)=>{const clipped=clipper.segment(a,b);return clipped?line(...clipped.screen):false;};
    const prepared=frames.map(f=>{const pose=instancePose(f.instance,phone,{elapsed:state.poseTime??(state.reducedMotion?0:state.elapsed)}),vertices=hasRipple(state.ripples,f.serial)?f.vertices.map(p=>deformRipplePoint(state.ripples,f.serial,p)):f.vertices,world=this.overlayOnly?[]:vertices.map(p=>transformPoint(p,pose)),points=world.map(pos),worldCorners=box(f.model.bounds).map(p=>transformPoint(p,pose)),corners=worldCorners.map(pos);return{...f,baseVertices:f.vertices,vertices,pose,world,points,worldCorners,corners,center:pos(pose.position),material:MATERIAL_KINDS[f.instance.materialIndex]};});this.poses=new Map(prepared.map(f=>[f.serial,f.pose]));

    const alive=prepared.filter(f=>f.edgeCount>0).length,edgeBudget=Math.max(1,Math.floor((phone?540:1200)/Math.max(1,alive)));
    this.fields=prepared.map(f=>{const field=sampleEdgeField({...f,vertices:f.baseVertices},{elapsed:state.elapsed,reducedMotion:state.reducedMotion,edgeBudget,segments:phone?4:6});return{serial:f.serial,...field,curves:field.curves.map(curve=>{const local=curve.points.map(p=>deformRipplePoint(state.ripples,f.serial,p));return{...curve,local,restLocal:curve.points,points:local.map(p=>transformPoint(p,f.pose))};}),points:[]};});
    for(const field of this.fields)applyPulseTint(field.curves,state.ripples,field.serial);
    const clippedFields=this.fields.map(field=>({serial:field.serial,curves:field.curves.map(curve=>({...curve,segments:curve.points.slice(1).map((point,i)=>clipper.segment(curve.points[i],point,curve.local[i],curve.local[i+1])).filter(Boolean)}))}));
    this.pickItems=clippedFields.map(field=>({serial:field.serial,triangles:[],curves:field.curves.flatMap(curve=>curve.segments.map(segment=>({...segment,alpha:curve.alpha}))),points:[]}));this.pickTargets=this.pickItems;

    this.renderedSegments=this.overlayOnly?this.fields.reduce((n,f)=>n+f.renderedSegments,0):clippedFields.reduce((n,f)=>n+f.curves.reduce((sum,curve)=>sum+curve.segments.length,0),0);this.renderedPoints=0;
    c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
    // Bounded proxy bundles retain exact closed-record ranges and counts, never hidden live meshes.
    const bundles=archiveBundles(state,phone?28:64);this.bundleCount=bundles.length;this.bundleRecords=bundles.reduce((n,b)=>n+b.count,0);
    for(let i=0;i<bundles.length;i++){
      const b=bundles[i],columns=phone?4:8,row=Math.floor(i/columns),x=(i%columns-(columns-1)/2)*(phone?2.2:2.35),origin=[x,3.2-row*.78,-7.8-row*.58],size=.47+Math.min(.22,Math.log2(b.count+1)*.05);
      c.strokeStyle='#bdbab1';c.lineWidth=.45;c.setLineDash([]);c.beginPath();const p=box([size,size*.73,size*.5]).map(q=>q.map((v,j)=>v+origin[j]));for(const[a,d]of BOX_EDGES)worldLine(p[a],p[d]);c.stroke();
      if(b.count>1&&(i%3===0||i===bundles.length-1)){const p=pos(origin);c.fillStyle='#87847c';c.font=`${phone?7:8}px 'Courier New',monospace`;if(p.visible&&p[0]>=0&&p[0]<=w&&p[1]>=0&&p[1]<=h)c.fillText(`×${b.count}`,p[0],p[1]);}
    }
    // Sparse spatial record links remain visible as the viewpoint passes through them.
    c.strokeStyle='#99978f';c.lineWidth=.45;c.globalAlpha=.38;c.beginPath();for(let i=1;i<prepared.length;i++){const current=prepared[i],prior=prepared.slice(0,i).reduce((best,f)=>Math.hypot(...f.pose.position.map((n,j)=>n-current.pose.position[j]))<Math.hypot(...best.pose.position.map((n,j)=>n-current.pose.position[j]))?f:best,prepared[0]);worldLine(current.pose.position,prior.pose.position);}c.stroke();c.globalAlpha=1;
    for(const f of prepared){c.strokeStyle=f.phase==='retained'?'#a09d94':'#c5c2b9';c.lineWidth=.5;c.setLineDash([2,4]);c.beginPath();for(const[a,b]of BOX_EDGES)worldLine(f.worldCorners[a],f.worldCorners[b]);c.stroke();}c.setLineDash([]);
    const triangles=[],triangleBudget=Math.max(0,Math.floor(Math.min(this.faceBudget,phone?980:2400))),facetLimit=Math.max(42,Math.floor(Math.min(this.faceBudget,phone?980:2400)/Math.max(1,frames.length)));
    const yaw=-.47+this.camera.yaw,tilt=.43+this.camera.pitch,view=[Math.sin(yaw)*Math.cos(tilt),Math.sin(tilt),Math.cos(yaw)*Math.cos(tilt)];
    faceLoop:for(const f of (this.overlayOnly?[]:prepared)){const stride=Math.max(1,Math.ceil(f.model.faces.length/facetLimit));for(let fi=f.instance.serial%stride;fi<f.model.faces.length;fi+=stride){const face=f.model.faces[fi],sourceCenter=[0,1,2].map(j=>face.reduce((n,i)=>n+f.model.stages[0].vertices[i][j],0)/3),patch=patchIndex(sourceCenter),layer=phaseInfo(f.instance.key,patch,state.elapsed,{reducedMotion:state.reducedMotion});if(layer.surfaceAlpha<.045)continue;const local=face.map(i=>f.vertices[i]);if(triangleArea(...local)<.00002)continue;const world=face.map(i=>f.world[i]),normal=normalOf(world),localNormal=normalOf(local);if(f.model.id!=='procedural-cube'&&Math.abs(localNormal[1])/(Math.hypot(...localNormal)||1)>.78)continue;const clipped=triangulateClippedPolygon(clipper.polygon(world,local));if(!clipped.length)continue;const center=world[0].map((v,j)=>(v+world[1][j]+world[2][j])/3),style=shadeFacet({material:f.material,normal,view,center,sourceCenter,sourceBounds:f.model.bounds,elapsed:state.elapsed,seed:f.instance.key});style.alpha*=layer.surfaceAlpha;for(const part of clipped){if(triangles.length>=triangleBudget)break faceLoop;const q=part.screen;triangles.push({q,world:part.world,local:part.local,style,material:f.material,depth:q.reduce((n,p)=>n+p[2],0)/3,fi,frame:f});}}}
    for(const t of triangles){const item=this.pickItems.find(i=>i.serial===t.frame.serial);item?.triangles.push({screen:t.q,local:t.local,world:t.world,alpha:t.style.alpha});}
    triangles.sort((a,b)=>a.depth-b.depth);this.facetCount=triangles.length;this.hatchCount=0;
    for(const t of triangles){c.globalAlpha=t.style.alpha;c.fillStyle=t.style.fill;c.beginPath();c.moveTo(...t.q[0].slice(0,2));c.lineTo(...t.q[1].slice(0,2));c.lineTo(...t.q[2].slice(0,2));c.closePath();c.fill();c.globalAlpha=1;
      if(t.material==='cut'&&t.fi%3===0){const segments=hatchTriangle(t.q.map(p=>p.slice(0,2)),{sourceTriangle:t.local,spacing:phone?.085:.065,maxSegments:5,seed:t.frame.instance.key});c.globalAlpha=.48;c.strokeStyle='#242422';c.lineWidth=.48;c.beginPath();for(const[a,b]of segments)line(a,b);c.stroke();this.hatchCount+=segments.length;c.globalAlpha=1;}
      if(t.material==='metal'&&t.style.highlightAlpha>.12){c.globalAlpha=t.style.highlightAlpha;c.strokeStyle=t.style.highlight;c.lineWidth=phone?.75:1;c.beginPath();line(t.q[0],t.q[1]);c.stroke();c.globalAlpha=1;}
    }
    for(const field of(this.overlayOnly?[]:clippedFields)){
      c.strokeStyle='#20221f';c.lineWidth=phone?.6:.55;for(const curve of field.curves){c.strokeStyle=curve.color?'rgb('+curve.color.map(v=>Math.round(v*255)).join(',')+')':'#20221f';c.globalAlpha=.55;c.beginPath();for(const segment of curve.segments)line(...segment.screen);c.stroke();}
      c.globalAlpha=1;
    }
    c.restore();c.globalAlpha=1;this.labels=[];
    for(const f of prepared){const visible=BOX_EDGES.flatMap(([a,b])=>clipper.segment(f.worldCorners[a],f.worldCorners[b])?.screen||[]);if(!visible.length)continue;const p=visible.reduce((a,b)=>a[1]<b[1]?a:b),x=Math.max(18,Math.min(w-(phone?111:151),p[0]+9)),initialY=Math.max(v.top-20,Math.min(v.bottom-5,p[1]-10)),y=placeLabelY(x,initialY,phone?110:146,this.labels,v.top-20,v.bottom-5);if(y===null)continue;
      c.strokeStyle='#1b1b17';c.lineWidth=.6;c.beginPath();line(p,[x,y+3]);line([x-3,y],[x+3,y]);c.stroke();c.fillStyle='#f0f0f0';c.fillRect(x+5,y-12,phone?105:143,phone?20:24);c.fillStyle='#191916';c.font=`${phone?10:10.5}px 'Courier New',monospace`;c.fillText(`A—${String(f.serial).padStart(3,'0')} / ${f.edgeCount}`,x+8,y);if(!phone){c.font="7px 'Courier New',monospace";c.fillStyle='#65635c';const field=this.fields.find(item=>item.serial===f.serial);c.fillText(`l=${field?.renderedSegments||0}`,x+8,y+10);}this.labels.push({x,y,id:f.model.id,serial:f.serial});
    }

    c.strokeStyle='#1b1b17';c.lineWidth=.7;for(const[x,y]of[[17,v.top-25],[w-17,v.top-25],[17,v.bottom+18],[w-17,v.bottom+18]]){c.beginPath();line([x-4,y],[x+4,y]);line([x,y-4],[x,y+4]);c.stroke();}
  }
  pick(x,y){if(x<0||x>this.width||y<0||y>this.height)return null;return pickProjected(x,y,this.pickItems||[],{lineTolerance:this.width<650?9:6,pointTolerance:this.width<650?11:8});}
  centralTarget(){const candidates=(this.pickItems||[]).flatMap(item=>item.curves.flatMap(curve=>curve.screen.map((screen,i)=>({serial:item.serial,screen,local:curve.local[i],world:curve.world?.[i]})))).filter(p=>p.screen.visible!==false&&p.screen[0]>=0&&p.screen[0]<=this.width&&p.screen[1]>=this.view.top&&p.screen[1]<=this.view.bottom);candidates.sort((a,b)=>Math.hypot(a.screen[0]-this.width/2,a.screen[1]-this.height/2)-Math.hypot(b.screen[0]-this.width/2,b.screen[1]-this.height/2));const p=candidates[0];if(!p)return null;const hit=this.pick(p.screen[0],p.screen[1]);return hit?{...hit,center:p.screen}:null;}

}
