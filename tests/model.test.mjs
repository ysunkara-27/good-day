import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule,progress,validatePlan,validateDay,localDay,timeLabel} from '../model.mjs';
const task=(id,minutes,done=false)=>({id,name:'A task',minutes,group:'Life',done});
test('tasks fill contiguous time and completion keeps the schedule stable',()=>{const p={start:540,tasks:[task('a',25,true),task('b',60)]};assert.deepEqual(schedule(p).map(t=>[t.start,t.end]),[[540,565],[565,625]]);assert.equal(progress(p.tasks),50);assert.equal(progress([]),0);});
test('overnight plans label tomorrow explicitly',()=>{assert.equal(timeLabel(1445),'12:05 am +1d');assert.equal(timeLabel(720),'12:00 pm');});
test('reject invalid dates, duplicate ids, oversized tasks and nonboolean completions',()=>{for(const day of ['2026-02-30','2026-13-01','x',null])assert.throws(()=>validateDay(day));assert.equal(validateDay('2026-09-15'),'2026-09-15');assert.equal(localDay(new Date(2026,0,2)),'2026-01-02');for(const tasks of [[task('a',0)],[task('a',481)],[task('a',25),task('a',25)],[{...task('a',25),done:1}],[{...task('a',25),name:' '}],Array.from({length:101},(_,i)=>task(String(i),5))])assert.throws(()=>validatePlan({start:540,tasks}));assert.throws(()=>validatePlan({start:-1,tasks:[]}));});

import {validatePet,defaultPet} from '../pet-profile.mjs';
test('dog profile defaults support existing users and reject invalid customization',()=>{
 assert.deepEqual(validatePet(),defaultPet);
 assert.equal(validatePet({...defaultPet,name:'  Mochi  '}).name,'Mochi');
 for(const patch of [{name:''},{name:'a'.repeat(25)},{coat:'__proto__'},{collar:'red'},{roaming:1},{species:'dragon'}])assert.throws(()=>validatePet({...defaultPet,...patch}));
});

test('fixed task times persist; missing or cleared times remain automatic',()=>{
 const pinned={...task('a',30),scheduledStart:0};
 assert.equal(validatePlan({start:540,tasks:[pinned]}).tasks[0].scheduledStart,0);
 assert.equal('scheduledStart' in validatePlan({start:540,tasks:[{...pinned,scheduledStart:null}]}).tasks[0],false);
 for(const start of [-1,1440,1.5,'09:00'])assert.throws(()=>validatePlan({start:540,tasks:[{...pinned,scheduledStart:start}]}));
});
test('automatic tasks fit around fixed slots without moving chosen times',()=>{
 const rows=schedule({start:540,tasks:[task('a',45),{...task('fixed',30),scheduledStart:570},task('b',15)]});
 assert.deepEqual(rows.map(t=>[t.id,t.start,t.end]),[['fixed',570,600],['a',600,645],['b',645,660]]);
 assert(rows.every(t=>!t.overlap));
 const gap=schedule({start:540,tasks:[task('a',30),{...task('fixed',30),scheduledStart:600},task('b',30)]});
 assert.deepEqual(gap.map(t=>[t.id,t.start]),[['a',540],['b',570],['fixed',600]]);
});
test('fixed tasks sort chronologically; explicit conflicts are visible and never moved',()=>{
 const rows=schedule({start:540,tasks:[{...task('late',60),scheduledStart:900},{...task('early',60),scheduledStart:510},{...task('overlap',30),scheduledStart:540},task('auto',30)]});
 assert.deepEqual(rows.map(t=>[t.id,t.start,t.overlap]),[['early',510,true],['overlap',540,true],['auto',570,false],['late',900,false]]);
});
test('midnight and overnight reservations retain their exact times',()=>{
 const rows=schedule({start:1410,tasks:[{...task('late',60),scheduledStart:1410},task('auto',15),{...task('midnight',10),scheduledStart:0}]});
 assert.deepEqual(rows.map(t=>[t.id,t.start,t.end]),[['midnight',0,10],['late',1410,1470],['auto',1470,1485]]);
});

test('cat appearance persists and switching back to a dog clears optional species',()=>{assert.equal(validatePet({...defaultPet,species:'cat'}).species,'cat');assert.deepEqual(validatePet({...defaultPet,species:'dog'}),defaultPet);});
