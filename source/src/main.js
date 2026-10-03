import './style.css';
import sculptureData from '../public/models/sculpture-wireframes.json';
import { createState, advance, holdPiece, moveHeld, releasePiece, neighboringPiece, DURATION, formatTime } from './simulation.js';
import { Landscape, unprojectDelta } from './renderer.js';
const $=s=>document.querySelector(s);
const canvas=$('#world'), motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let state=createState({reducedMotion:motionPreference.matches,models:sculptureData.groups}), renderer=new Landscape(canvas,sculptureData.groups);
let last=0, hover=null, pointer=null, keyboard=false, dirty=true, lastLabel='', audio=null, soundOn=false, audioSuspended=false;
let lastAnnouncement='', lastDraw=0;
const say=text=>{if(text!==lastAnnouncement){$('#announcement').textContent=text;lastAnnouncement=text;}};
function resize(){renderer.resize(innerWidth,document.querySelector('#app').clientHeight,Math.min(devicePixelRatio||1,innerWidth<650?1.5:2));dirty=true;}
function endHold(){if(releasePiece(state)){document.body.dataset.held='false';pointer=null;dirty=true;updateUI();say(state.paused || state.elapsed >= DURATION ? '已放开，位置与痕迹保留。' : '已放开。作品继续缓慢迁移。');}}
function updateUI(){
  const held=state.held!==null, settled=state.elapsed>=DURATION;
  const phase=held?'局部暂留 / HELD':state.paused?'时间暂停 / PAUSED':settled?'残余 / REMAINDER':'迁移中 / DRIFTING';
  $('#phase-label').textContent=phase;$('#pause').setAttribute('aria-pressed',String(state.paused));$('#pause span').textContent=state.paused?'继续':'暂停';
  document.body.dataset.held=String(held);document.body.dataset.keyboard=String(keyboard);
  let zh='按住一件作品，让它暂时停留。', en='Hold one sculpture. Let the rest move.';
  if(held){zh=state.paused||settled?'拖动它，改变与周围的距离。':'这一件停下了，其余仍在迁移。';en=state.paused||settled?'Drag it. Change the distances around it.':'This sculpture stays. The ground keeps moving.';}
  if(state.hasMoved){zh='它还在，原来的位置已经空了。';en='It is still here. Where it was is now empty.';}
  if(settled&&!held&&!state.hasMoved){zh='迁移已止，你仍能改变它。';en='The drift has settled. You can still change it.';}
  if(state.paused&&!held&&!state.hasMoved){zh='时间暂停。你仍可以移动一处。';en='Time is paused. You can still move a piece.';}
  $('#instruction').textContent=zh;$('#instruction-en').textContent=en;
}
function contact(x,y){$('#contact').style.left=`${x}px`;$('#contact').style.top=`${y}px`;}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||pointer!==null)return;
  const id=renderer.hit(event.clientX,event.clientY);if(id===null)return;
  event.preventDefault();keyboard=false;
  if(state.held!==null)endHold();
  if(!holdPiece(state,id))return;
  pointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});contact(event.clientX,event.clientY);dirty=true;updateUI();say('按住了这件作品。拖动可以移动，松开继续迁移。');
});
canvas.addEventListener('pointermove',event=>{
  if(pointer&&event.pointerId===pointer.id){
    const d=unprojectDelta(event.clientX-pointer.x,event.clientY-pointer.y,renderer.view.scale);moveHeld(state,d.x,d.z);pointer.x=event.clientX;pointer.y=event.clientY;contact(event.clientX,event.clientY);dirty=true;updateUI();
  }else if(!pointer){const id=renderer.hit(event.clientX,event.clientY);if(hover!==id){hover=id;dirty=true;}}
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{if(pointer&&event.pointerId===pointer.id)endHold();});
canvas.addEventListener('pointerleave',()=>{if(!pointer){hover=null;dirty=true;}});
canvas.addEventListener('keydown',event=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter','Escape'].includes(event.key))event.preventDefault();else return;
  keyboard=true;hover=null;
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(directions[event.key]){const [x,z]=directions[event.key];if(state.held===null){state.selected=neighboringPiece(state,x,z);say(`已选取${state.pieces[state.selected].label}。空格按住。`);}else{moveHeld(state,x*.22,z*.22);say('作品已移动。空格放开。');}}
  if((event.key===' '||event.key==='Enter')&&!event.repeat){if(state.held!==null)endHold();else{holdPiece(state,state.selected);say('已按住。用方向键移动，空格放开。');}}
  if(event.key==='Escape')endHold();
  dirty=true;updateUI();
});
canvas.addEventListener('blur',()=>{if(keyboard){endHold();keyboard=false;updateUI();dirty=true;}});
function reset(){endHold();state=createState({reducedMotion:state.paused,models:sculptureData.groups});hover=null;keyboard=false;last=performance.now();dirty=true;updateUI();say('已重新开始，本次痕迹已清除。');}
$('#reset').addEventListener('click',reset);
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;dirty=true;updateUI();say(state.paused?'时间暂停，仍可移动作品。':'时间继续。');});
addEventListener('keydown',event=>{if(event.key.toLowerCase()==='r'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!$('#rules').open)reset();});
const rules=$('#rules');
$('#rules-open').addEventListener('click',()=>{endHold();rules.showModal();});
for(const selector of ['#rules-close','#rules-return'])$(selector).addEventListener('click',()=>rules.close());
rules.addEventListener('click',event=>{if(event.target===rules){const b=rules.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)rules.close();}});
rules.addEventListener('close',()=>{last=performance.now();dirty=true;});
addEventListener('blur',()=>{endHold();});
document.addEventListener('visibilitychange',()=>{endHold();last=performance.now();if(audio){if(document.hidden){audio.context.suspend().catch(()=>{});audioSuspended=true;}else if(soundOn&&audioSuspended){audio.context.resume().catch(()=>{});audioSuspended=false;}}});
motionPreference.addEventListener('change',event=>{if(event.matches){state.paused=true;updateUI();dirty=true;}});
$('#sound').addEventListener('click',async()=>{
  try{
    if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');const context=new Audio();const gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);const voices=[62,93,124].map(frequency=>{const oscillator=context.createOscillator();oscillator.type='sine';oscillator.frequency.value=frequency;oscillator.connect(gain);oscillator.start();return oscillator;});audio={context,gain,voices};}
    soundOn=!soundOn;if(soundOn)await audio.context.resume();audio.gain.gain.setTargetAtTime(soundOn?.008:0,audio.context.currentTime,.35);$('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound span').textContent=soundOn?'开':'关';
  }catch{soundOn=false;$('#sound span').textContent='不可用';say('当前浏览器无法播放声音，视觉交互不受影响。');}
});
function frame(now){
  requestAnimationFrame(frame);
  if(!last)last=now;const dt=(now-last)/1000;last=now;
  if(document.hidden||rules.open)return;
  const active=!state.paused&&state.elapsed<DURATION;
  if(active)advance(state,dt);
  if((dirty||active)&&now-lastDraw>=1000/40){renderer.draw(state,hover,keyboard);dirty=false;lastDraw=now;}
  const time=formatTime(state.elapsed);if(time!==lastLabel){$('#elapsed').textContent=time;lastLabel=time;if(state.elapsed>=DURATION)updateUI();}
  if(audio&&soundOn){audio.voices[1].frequency.setTargetAtTime(state.held===null?93:99+state.pieces[state.held].dx*.5,audio.context.currentTime,.25);audio.gain.gain.setTargetAtTime(state.paused?.004:state.held===null?.008:.015,audio.context.currentTime,.3);}
  // Expose only DOM presentation state for repeatable black-box verification.
  document.body.dataset.phase=state.elapsed>=DURATION?'settled':state.paused?'paused':'drifting';
  document.body.dataset.moved=String(state.hasMoved);
}
if(!renderer.ctx){$('#unsupported').hidden=false;document.body.dataset.status='unsupported';}else{resize();updateUI();renderer.draw(state);document.body.dataset.status='ready';requestAnimationFrame(frame);}
addEventListener('resize',resize);
