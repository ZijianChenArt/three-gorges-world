/** Pure pointer arbitration shared by mouse, pen and touch. No synthetic DOM events. */
export class GestureController{
  constructor(actions){this.actions=actions;this.pointers=new Map();this.mode='idle';this.held=false;this.holdDelay=480;}
  pair(){const p=[...this.pointers.values()];return{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,distance:Math.max(1,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y))};}
  releaseHold(){if(this.held){this.actions.holdEnd?.();this.held=false;}}
  down({id,x,y,button=0,now=0}){
    if(button!==0&&button!==2)return false;
    this.pointers.set(id,{x,y,startX:x,startY:y,button,started:now});
    if(this.pointers.size===1){this.mode=button===2?'pan':'pending';this.origin={x,y};}
    else if(this.pointers.size===2){this.releaseHold();this.mode='pinch';this.previousPair=this.pair();}
    return true;
  }
  move({id,x,y}){
    const p=this.pointers.get(id);if(!p)return;const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;
    if(this.pointers.size>=2){const next=this.pair(),last=this.previousPair;this.actions.pan?.(next.x-last.x,next.y-last.y);this.actions.zoom?.(next.distance/last.distance);this.previousPair=next;return;}
    const distance=Math.hypot(x-p.startX,y-p.startY);
    if(this.mode==='pending'&&distance>6)this.mode=p.button===2?'pan':'orbit';
    if(this.mode==='hold'&&distance>12){this.releaseHold();this.mode='orbit';}
    if(this.mode==='orbit')this.actions.orbit?.(dx,dy);
    if(this.mode==='pan')this.actions.pan?.(dx,dy);
  }
  tick(now){if(this.mode!=='pending'||this.pointers.size!==1)return;const p=[...this.pointers.values()][0];if(now-p.started>=this.holdDelay){this.mode='hold';this.held=!!this.actions.holdStart?.(p.startX,p.startY);}}
  up(id,cancelled=false){
    const p=this.pointers.get(id);if(!p)return;
    if(this.mode==='pending'&&!cancelled)this.actions.tap?.(p.startX,p.startY);
    this.releaseHold();this.pointers.delete(id);
    if(this.pointers.size>=2){this.mode='pinch';this.previousPair=this.pair();}
    else if(this.pointers.size===1){const left=[...this.pointers.values()][0];left.startX=left.x;left.startY=left.y;this.mode='orbit';}
    else this.mode='idle';
  }
  cancel(){this.releaseHold();this.pointers.clear();this.mode='idle';}
}
