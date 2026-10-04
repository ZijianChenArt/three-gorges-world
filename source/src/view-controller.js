import {automaticCamera} from './flight-camera.js';
import {createCamera} from './camera.js';
const copy=c=>c?{...c,target:c.target.slice()}:null;
/** Navigation alone can take the autonomous camera over. Taps never enter here. */
export class ViewController{
  constructor(route=automaticCamera){this.route=route;this.manual=createCamera();this.time=0;this.base=null;this.displayedBase=null;this.displayedManual=null;this.active=false;this.lastNavigation=-Infinity;}
  inspecting(now){return this.active||now-this.lastNavigation<2400;}
  noteNavigation(now){if(!this.inspecting(now)&&this.displayedBase)this.base=copy(this.displayedBase);this.lastNavigation=now;}
  beginNavigation(now){const takingOver=!this.inspecting(now);this.noteNavigation(now);if(takingOver&&this.displayedManual)Object.assign(this.manual,this.displayedManual);this.active=true;}
  endNavigation(now){if(!this.active)return;this.active=false;this.lastNavigation=now;}
  markDisplayed(){this.displayedBase=copy(this.base);this.displayedManual={...this.manual};}
  step(dt,now,{paused=false,reducedMotion=false,phone=false,scene}={}){
    dt=Number.isFinite(dt)?Math.max(0,dt):0;const inspecting=this.inspecting(now);
    if(!this.base)this.base=this.route(this.time,phone,scene);
    if(!paused&&!reducedMotion&&!inspecting){
      this.time+=dt;const goal=this.route(this.time,phone,scene),a=1-Math.exp(-dt*2.8),next={...goal};
      for(const key of ['pitch','distance','zoom'])next[key]=this.base[key]+(goal[key]-this.base[key])*a;
      const yawDelta=Math.atan2(Math.sin(goal.yaw-this.base.yaw),Math.cos(goal.yaw-this.base.yaw));next.yaw=this.base.yaw+yawDelta*a;
      next.target=this.base.target.map((v,i)=>v+(goal.target[i]-v)*a);this.base=next;
      const decay=Math.exp(-dt*1.25);for(const key of ['yaw','pitch','panX','panY'])this.manual[key]*=decay;this.manual.zoom=1+(this.manual.zoom-1)*decay;
    }
    return this.camera;
  }
  get camera(){const a=this.base,m=this.manual;return a?{...a,yaw:a.yaw+m.yaw,pitch:a.pitch+m.pitch,zoom:a.zoom*m.zoom,panX:m.panX,panY:m.panY}:null;}
}
