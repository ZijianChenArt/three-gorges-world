import './style.css';
import sculptureData from '../public/models/sculpture-wireframes.json';
import {createState,advance,phaseFor} from './simulation.js';
import {Formation} from './renderer.js';
const $=selector=>document.querySelector(selector),canvas=$('#world'),preference=matchMedia('(prefers-reduced-motion: reduce)');
const seed=crypto.getRandomValues(new Uint32Array(1))[0];
const state=createState({reducedMotion:preference.matches,seed}),renderer=new Formation(canvas,sculptureData.groups);
let last=0,lastDraw=0,dirty=true;
function updateUI(){const pause=$('#pause');pause.setAttribute('aria-pressed',String(state.paused));pause.innerHTML=state.paused?'播放 <span aria-hidden="true">▷</span>':'暂停 <span aria-hidden="true">Ⅱ</span>';document.body.dataset.playing=String(!state.paused);}
function resize(){renderer.resize(innerWidth,$('#app').clientHeight,Math.min(devicePixelRatio||1,innerWidth<650?1.5:2));dirty=true;}
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;last=performance.now();dirty=true;updateUI();$('#announcement').textContent=state.paused?'画面已暂停。':'作品继续自动运行。';});
const about=$('#about');$('#about-open').addEventListener('click',()=>about.showModal());
for(const id of ['#about-close','#about-return'])$(id).addEventListener('click',()=>about.close());
about.addEventListener('click',event=>{if(event.target===about){const r=about.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)about.close();}});
about.addEventListener('close',()=>{last=performance.now();dirty=true;});
document.addEventListener('visibilitychange',()=>{last=performance.now();dirty=true;});
preference.addEventListener('change',event=>{if(event.matches){state.paused=true;updateUI();dirty=true;}});
function frame(now){requestAnimationFrame(frame);if(!last)last=now;const dt=(now-last)/1000;last=now;if(document.hidden||about.open)return;if(!state.paused)advance(state,dt);if((dirty||!state.paused)&&now-lastDraw>=1000/36){renderer.draw(state);lastDraw=now;dirty=false;}document.body.dataset.phases=state.scores.map(s=>phaseFor(s,state.elapsed)).join(',');document.body.dataset.cycles=state.scores.map(s=>s.index).join(',');}
if(!renderer.ctx){$('#unsupported').hidden=false;document.body.dataset.status='unsupported';}else{resize();updateUI();renderer.draw(state);document.body.dataset.status='ready';requestAnimationFrame(frame);}
addEventListener('resize',resize);
