import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleCare,readCare} from '../care-api.mjs';
import {careDay,idleBehavior} from '../care-model.mjs';
import {findPath,clearPath} from '../pet-world.mjs';
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};},async first(){return db.prepare(sql).get(...args)||null;}};},async batch(rows){return Promise.all(rows.map(row=>row.run()));}};
 for(const id of ['one','two'])db.prepare('INSERT INTO dog_users VALUES (?,?,?,?)').run(id,id,'salt','hash');
 const now=new Date('2026-09-16T15:00:00Z'),day='2026-09-16';
 const save=(done,total=4,date=day,user='one')=>db.prepare('INSERT OR REPLACE INTO dog_days VALUES (?,?,?,1)').run(user,date,JSON.stringify({tasks:Array.from({length:total},(_,i)=>({id:`task-${i}`,name:`Task ${i}`,done:i<done}))}));
 const read=(user='one',date=now)=>readCare({DB},user,'America/New_York',date);
 const act=(action,user='one',date=day)=>handleCare(new Request('https://example.test/dog/care?zone=America%2FNew_York',{method:'POST'}),{DB},{id:user},{action,day:date},(data,status=200)=>Response.json(data,{status}),now);
 return {db,save,read,act};
}
test('care only follows saved completion, is one-time, and survives undo/reload',async()=>{
 const f=fixture();try{
  f.save(0);assert.equal((await f.act('meal')).status,409);
  f.save(1);let care=await f.read();assert.equal(care.unlocked,1);assert.equal(care.lifetime,1);
  assert.equal((await f.act('walk')).status,409);assert.equal((await f.act('meal')).status,200);assert.equal((await f.act('meal')).status,409);
  f.save(0);care=await f.read();assert.equal(care.used,1);assert.equal(care.unlocked,1);
  f.save(1);assert.equal((await f.read()).lifetime,1);
  f.save(2);assert.equal((await f.act('walk')).status,200);assert.equal((await f.act('rest')).status,409);
  f.save(4);assert.equal((await f.act('rest')).status,200);care=await f.read();assert.equal(care.used,7);assert.deepEqual(care.tricks,['paw']);assert.equal(care.last.action,'rest');
  assert.equal((await f.act('meal','two')).status,409);assert.equal((await f.read('two')).lifetime,0);
 }finally{f.db.close();}
});
test('short plans unlock full care; past/future plans do not; rollover keeps memories',async()=>{
 const f=fixture();try{
  f.save(4,4,'2026-09-15');f.save(4,4,'2026-09-17');assert.equal((await f.read()).unlocked,0);
  f.save(1,1);assert.equal((await f.read()).unlocked,3);await f.act('meal');
  f.save(1,20);assert.equal((await f.read()).unlocked,3);
  assert.equal((await f.act('walk','one','2026-09-15')).status,409);
  const next=await f.read('one',new Date('2026-09-18T15:00:00Z'));assert.equal(next.used,0);assert.equal(next.unlocked,0);assert.equal(next.last.action,'meal');assert.equal(next.lifetime,1);
 }finally{f.db.close();}
});
test('timezone midnight and context priorities are explicit',()=>{
 assert.equal(careDay('America/New_York',new Date('2026-09-17T02:00:00Z')),'2026-09-16');
 assert.throws(()=>careDay('invalid'));
 assert.equal(idleBehavior({care:{used:0},focused:true}),'sleep');
 assert.equal(idleBehavior({care:{used:0},sequence:0}),'bowl');
 assert.equal(idleBehavior({care:{used:1},sequence:0}),'bow');
 assert.equal(idleBehavior({care:{used:7},sequence:1}),'curl');
});
test('routes avoid obstacles throughout travel, including narrow corridors',()=>{
 const bounds={width:1000,height:800},obstacles=[{left:300,right:650,top:220,bottom:540}],a={x:100,y:350},b={x:800,y:350};
 assert.equal(clearPath(a,b,obstacles,bounds),false);
 const path=findPath(a,b,obstacles,bounds);assert(path.length>2);
 for(let i=1;i<path.length;i++)assert(clearPath(path[i-1],path[i],obstacles,bounds));
 assert.equal(findPath(a,{x:400,y:300},obstacles,bounds),null);
 assert.equal(findPath({x:8,y:8},{x:8,y:100},[],{width:65,height:200}),null);
});
