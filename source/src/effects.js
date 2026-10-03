import {sourcePoint,edgeAmount,edgeFrame,mix,clamp} from './simulation.js';

function convexHull(points){
  const unique=[...new Map(points.map(p=>[`${p[0].toFixed(4)},${p[2].toFixed(4)}`,p])).values()].sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
  if(unique.length<3)return[];
  const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
  const lower=[],upper=[];
  for(const p of unique){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of [...unique].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  lower.pop();upper.pop();return lower.concat(upper);
}
export function prepareEffects(model){
  const sections=[];
  for(const fraction of [.12,.27,.43,.6,.76,.9]){
    const y=model.size[1]*fraction,points=[];
    for(let i=0;i<model.edges.length;i+=6){const e=model.edges,dy=e[i+4]-e[i+1];if(Math.abs(dy)<1e-6)continue;const t=(y-e[i+1])/dy;if(t>=0&&t<=1)points.push([mix(e[i],e[i+3],t),y,mix(e[i+2],e[i+5],t)]);}
    const hull=convexHull(points);if(hull.length>=3)sections.push(hull);
  }
  const ranked=[];for(let i=0;i<model.edges.length;i+=6){const e=model.edges;ranked.push({i,length:Math.hypot(e[i+3]-e[i],e[i+4]-e[i+1],e[i+5]-e[i+2])});}
  const echoEdges=ranked.sort((a,b)=>b.length-a.length).slice(0,180).map(v=>v.i/6);
  return{sections,echoEdges};
}
export function materialEffects(model,score,elapsed,traits,prepared){
  const amount=edgeAmount(score,elapsed,.25,.2),paths=[],curves=[];
  if(amount<.015)return{paths,curves};
  if(score.material===0){
    // Thin contours are cross-sections of the actual source wire geometry.
    for(let j=0;j<prepared.sections.length;j++){
      const section=prepared.sections[j],phase=score.angle+j*.65+elapsed*.028;
      const pull=amount*(1.5+j*.5),points=section.map((p,i)=>{
        const q=sourcePoint(model,...p,elapsed),u=i/section.length*Math.PI*2;
        return[q[0]+Math.cos(phase)*pull+Math.sin(u*2+phase)*amount*.28,q[1]+(j-2.5)*amount*.7+Math.sin(u+phase)*amount*.22,q[2]+Math.sin(phase)*pull];
      });
      points.push(points[0]);paths.push({points,alpha:amount*(.08+.035*Math.sin(phase)**2),width:.55,kind:'contour'});
    }
  }else if(score.material===1){
    // Curves follow the analytical recent trajectory of individual source edges.
    let count=0;
    for(let e=0;e<model.edges.length/6&&count<64;e++){
      const tr=traits[e];if(tr[13]<.945)continue;
      const a=edgeFrame(model,score,elapsed,e,tr),b=edgeFrame(model,score,elapsed-(5+tr[14]*5),e,tr);
      const end=[(a[0]+a[3])/2,(a[1]+a[4])/2,(a[2]+a[5])/2],start=[(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2];
      const phase=tr[6]*Math.PI*2+elapsed*.033,bend=amount*(.45+tr[15]*.6);
      const control=start.map((v,k)=>mix(v,end[k],.5));control[0]+=Math.cos(phase)*bend;control[1]+=Math.sin(phase)*bend;control[2]+=Math.sin(phase*.7)*bend;
      curves.push({start,control,end,alpha:amount*(.12+tr[15]*.11),width:.55,kind:'filament'});count++;
    }
  }else if(score.material===2){
    // Four very spare orbit arcs spatially relate the clustered endpoint dots.
    for(let family=0;family<4;family++){
      const phase=score.angle+family*Math.PI/2+elapsed*.025,points=[];
      for(let i=0;i<=20;i++){const u=phase-.48+i/20*.96,r=3.2+score.spread*1.2;const q=sourcePoint(model,0,model.halfY,0,elapsed);points.push([q[0]+Math.cos(u)*r,q[1]+Math.sin(u*.7+family)*1.1,q[2]+Math.sin(u)*r]);}
      paths.push({points,alpha:amount*.085,width:.5,kind:'orbit'});
    }
  }else{
    // Sparse original structural edges form two receding, low-contrast echoes.
    for(let layer=1;layer<=2;layer++){
      const shift=amount*layer*(.8+.2*Math.sin(elapsed*.032+score.angle));
      for(const e of prepared.echoEdges){const i=e*6,points=[];
        for(const k of [0,3]){const q=sourcePoint(model,model.edges[i+k],model.edges[i+k+1],model.edges[i+k+2],elapsed);points.push([q[0]+Math.cos(score.angle)*shift,q[1]+shift*.32,q[2]-shift*1.8]);}
        paths.push({points,alpha:amount*(layer===1?.078:.035),width:.48,kind:'echo'});
      }
    }
  }
  return{paths,curves};
}
export function depthStyle(depth){const t=clamp((depth+12)/24,0,1);return{opacity:.67+t*.33,width:.43+t*.43,pointScale:.7+t*.7};}
