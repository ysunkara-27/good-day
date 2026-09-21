import {test} from 'node:test';
import assert from 'node:assert/strict';
globalThis.document=new EventTarget();
const {publishCompanion}=await import('../companion-bridge.mjs?fixture');
const events=[];document.addEventListener('taskpup:companion-state',event=>events.push(JSON.parse(event.detail)));
const state={signedIn:true,pet:{name:'Pip',coat:'cream',collar:'sage',roaming:true},care:{used:0,unlocked:0},focused:false};
test('the planner emits changes only, answers fresh handshakes, and clears on logout',()=>{
 publishCompanion(state);publishCompanion(state);assert.equal(events.length,1);
 document.dispatchEvent(new Event('taskpup:companion-request'));assert.equal(events.length,2);
 publishCompanion({...state,focused:true});assert.equal(events.length,3);assert.equal(events.at(-1).focused,true);
 publishCompanion({...state,care:null});assert.equal(events.length,3);
 publishCompanion({signedIn:false});assert.deepEqual(events.at(-1),{version:1,connected:false});
});
