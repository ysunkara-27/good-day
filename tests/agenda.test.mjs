import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAgenda} from '../agenda.mjs';
const day='2026-09-16',zone='America/New_York';
const plan={start:540,tasks:[{id:'task',name:'Read',minutes:30,group:'',done:false}]};
const events=[{id:'busy',title:'Meeting',busy:true,start:{dateTime:day+'T09:00:00-04:00'},end:{dateTime:day+'T10:00:00-04:00'}},{id:'free',title:'Reminder',busy:false,start:{dateTime:day+'T10:00:00-04:00'},end:{dateTime:day+'T11:00:00-04:00'}},{id:'all-day',title:'Holiday',busy:true,start:{date:day},end:{date:'2026-09-17'}}];
test('view filters cannot change scheduling or reserve time for free and all-day events',()=>{
 const original=structuredClone(plan);
 for(const view of ['all','tasks','calendar']){
  const agenda=buildAgenda(plan,events,day,zone,view);
  assert.equal(agenda.scheduled[0].start,600);
  assert.equal(agenda.rows.length,view==='all'?3:view==='tasks'?1:2);
  assert.equal(agenda.allDay.length,view==='tasks'?0:1);
 }
 assert.deepEqual(plan,original);
});
test('fixed conflicts remain visible and disconnect removes only external reservations',()=>{
 const fixed={...plan,tasks:[{...plan.tasks[0],scheduledStart:555}]};
 assert.equal(buildAgenda(fixed,events,day,zone,'tasks').scheduled[0].overlap,true);
 assert.equal(buildAgenda(plan,[],day,zone).scheduled[0].start,540);
 assert.equal(buildAgenda(plan,events,'2026-09-17',zone).events.length,0);
});
