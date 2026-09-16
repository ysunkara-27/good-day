import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {carryForward} from '../rollover.mjs';
import {validatePlan} from '../model.mjs';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));sql.exec("INSERT INTO dog_users VALUES ('one','one','salt','hash'),('two','two','salt','hash')");
 const DB={prepare(query){let args=[];return{bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)||null;},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const stmt of statements)out.push(await stmt.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const put=(day,tasks,user='one')=>sql.prepare('INSERT INTO dog_days VALUES (?,?,?,0)').run(user,day,JSON.stringify({start:600,tasks}));
 const get=(day,user='one')=>{const r=sql.prepare('SELECT * FROM dog_days WHERE user_id=? AND day=?').get(user,day);return r?{...r,plan:JSON.parse(r.data)}:null;};
 return{sql,env:{DB},put,get};
}
const task=(id,done=false)=>({id,name:id,minutes:30,group:'Work',done,scheduledStart:840});
test('rollover moves unfinished tasks once, clears fixed times, preserves completed and future tasks and isolates users',async()=>{
 const f=fixture();try{
 f.put('2026-09-14',[task('old'),task('done',true)]);f.put('2026-09-15',[task('yesterday')]);f.put('2026-09-16',[task('existing')]);f.put('2026-09-17',[task('future')]);f.put('2026-09-15',[task('other')],'two');
 assert.deepEqual(await carryForward(f.env,'one','2026-09-16'),{moved:2,pending:0});
 const today=f.get('2026-09-16');assert.deepEqual(today.plan.tasks.map(t=>t.name),['existing','old','yesterday']);assert.equal(today.plan.tasks[0].scheduledStart,840);assert.equal(today.plan.tasks[1].scheduledStart,undefined);validatePlan(today.plan);
 assert.deepEqual(f.get('2026-09-14').plan.tasks.map(t=>t.name),['done']);assert.equal(f.get('2026-09-15').plan.tasks.length,0);assert.equal(f.get('2026-09-17').plan.tasks.length,1);assert.equal(f.get('2026-09-15','two').plan.tasks.length,1);
 assert.equal(today.revision,1);assert.equal(f.get('2026-09-14').revision,1);assert.deepEqual(await carryForward(f.env,'one','2026-09-16'),{moved:0,pending:0});assert.equal(f.get('2026-09-16').revision,1);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM dog_rollover_moves').get().n,0);
 }finally{f.sql.close();}
});
test('capacity preserves overflow and disabled carryover preserves all days',async()=>{
 const f=fixture();try{
 f.put('2026-09-15',[task('a'),task('b')]);f.put('2026-09-16',Array.from({length:99},(_,i)=>task('existing'+i)));
 assert.deepEqual(await carryForward(f.env,'one','2026-09-16'),{moved:1,pending:1});assert.equal(f.get('2026-09-16').plan.tasks.length,100);assert.equal(f.get('2026-09-15').plan.tasks[0].name,'b');
 f.sql.prepare('INSERT INTO dog_settings VALUES (?,0)').run('one');assert.deepEqual(await carryForward(f.env,'one','2026-09-17'),{moved:0,pending:0});assert.equal(f.get('2026-09-17'),null);
 }finally{f.sql.close();}
});
test('failed destination write rolls back the whole transfer and stale source revisions cannot overwrite it',async()=>{
 const f=fixture();try{
 f.put('2026-09-15',[task('a')]);f.sql.exec("CREATE TRIGGER fail_rollover BEFORE UPDATE ON dog_days WHEN NEW.day='2026-09-16' BEGIN SELECT RAISE(ABORT,'test failure'); END");
 await assert.rejects(()=>carryForward(f.env,'one','2026-09-16'));assert.equal(f.get('2026-09-15').plan.tasks.length,1);assert.equal(f.get('2026-09-16'),null);
 f.sql.exec('DROP TRIGGER fail_rollover');await carryForward(f.env,'one','2026-09-16');assert.equal(f.sql.prepare("UPDATE dog_days SET data=data WHERE user_id='one' AND day='2026-09-15' AND revision=0").run().changes,0);
 }finally{f.sql.close();}
});
