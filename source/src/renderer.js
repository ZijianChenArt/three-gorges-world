import {prepareModels,transformPoint,morphAt} from './simulation.js';
const YAW=-.2,TILT=.34,cy=Math.cos(YAW),sy=Math.sin(YAW),ct=Math.cos(TILT),st=Math.sin(TILT);
export function projectRaw(x,y,z){const rx=x*cy-z*sy,depth=x*sy+z*cy;return[rx,depth*st-y*ct,depth*ct+y*st];}
export function fittedView(width,height,bounds){
  const phone=width<650,top=phone?96:86,bottom=height-(phone?246:200);
  const stageHeight=Math.max(140,bottom-top),scale=Math.min((width-(phone?26:80))/(bounds.maxX-bounds.minX||1),stageHeight/(bounds.maxY-bounds.minY||1));
  return{scale,cx:width/2-(bounds.minX+bounds.maxX)*scale/2,cy:top+stageHeight/2-(bounds.minY+bounds.maxY)*scale/2};
}
export class Formation{
  constructor(canvas,groups){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.models=prepareModels(groups);this.width=0;this.height=0;this.lastBounds=null;}
  resize(width,height,dpr=1){this.width=width;this.height=height;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.ctx?.setTransform(dpr,0,0,dpr,0,0);}
  geometry(elapsed){const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};const groups=this.models.map(model=>{const points=new Float32Array(model.segments.length);for(let i=0;i<model.segments.length;i+=3){const q=transformPoint(model,model.segments[i],model.segments[i+1],model.segments[i+2],elapsed),p=projectRaw(...q);points[i]=p[0];points[i+1]=p[1];points[i+2]=p[2];bounds.minX=Math.min(bounds.minX,p[0]);bounds.maxX=Math.max(bounds.maxX,p[0]);bounds.minY=Math.min(bounds.minY,p[1]);bounds.maxY=Math.max(bounds.maxY,p[1]);}return{points,index:model.index,morph:morphAt(elapsed,model.index)};});return{groups,bounds};}
  draw(elapsed){const c=this.ctx;if(!c)return;const{width:w,height:h}=this;c.fillStyle='#fafafa';c.fillRect(0,0,w,h);const{groups,bounds}=this.geometry(elapsed),view=fittedView(w,h,bounds);this.lastBounds=bounds;this.view=view;
    for(const group of groups){const alpha=.68-group.morph*.38;c.strokeStyle=`rgba(15,15,15,${alpha.toFixed(3)})`;c.lineWidth=(w<650?.52:.68)-group.morph*.1;c.beginPath();for(let i=0;i<group.points.length;i+=6){c.moveTo(view.cx+group.points[i]*view.scale,view.cy+group.points[i+1]*view.scale);c.lineTo(view.cx+group.points[i+3]*view.scale,view.cy+group.points[i+4]*view.scale);}c.stroke();}
    // Quiet registration strokes frame the live drawing without an interface grid.
    c.strokeStyle='#909090';c.lineWidth=.6;for(const[x,y]of[[23,75],[w-23,75],[23,h-83],[w-23,h-83]]){c.beginPath();c.moveTo(x-3,y);c.lineTo(x+3,y);c.moveTo(x,y-3);c.lineTo(x,y+3);c.stroke();}
  }
}
