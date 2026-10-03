import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Landscape,deformGround} from '../src/renderer.js';
import {createState,holdPiece,moveHeld} from '../src/simulation.js';
const context=()=>new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});
test('drawing works with a 2D canvas and no WebGL methods',()=>{const models=Array.from({length:5},(_,id)=>({center:[id,0,id],edges:[-1,0,-1,1,2,1]}));const canvas={getContext:type=>{assert.equal(type,'2d');return context();}};const r=new Landscape(canvas,models);for(const[w,h]of[[1440,1000],[390,844],[320,568],[844,390]]){r.resize(w,h,1);r.draw(createState({models}));assert.equal(r.hits.length,5);assert.ok(r.hits.every(hit=>Object.values(hit.bounds).every(Number.isFinite)));}});
test('dragging a sculpture changes the surrounding ground',()=>{const s=createState(),p=s.pieces[0],before=deformGround(p.x,p.z,s);holdPiece(s,0);moveHeld(s,2,3);const after=deformGround(p.x,p.z,s);assert.notDeepEqual(before,after);assert.ok(after.every(Number.isFinite));});
test('a sculpture can be picked by its projected edge',()=>{const r=new Landscape({getContext:()=>context()},[{edges:[-1,0,0,1,1,0]}]);r.resize(800,600,1);const state=createState({models:[{center:[0,0,0],name:'test'}]});state.pieces.push(...createState().pieces.slice(1));r.draw(state);const a=r.hits[0].segments[0][0];assert.equal(r.hit(a.x,a.y),0);assert.equal(r.hit(-500,-500),null);});
