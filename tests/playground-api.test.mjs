import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleDog} from '../api.mjs';
import {careDay} from '../care-model.mjs';
test('authenticated day/save/care responses grant Yash previews without bypassing earned care',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const env={DB:{prepare(sql){let args=[];return {bind(...values){args=values;return this},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}}};
 const call=(path,method='GET',body,token)=>handleDog(new Request('https://test/dog/'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 try{
  const day=careDay('UTC'),account=await (await call('signup','POST',{username:'yash',password:'test-password'})).json(),token=account.token;assert(token);
  const read=await (await call('day?date='+day,'GET',null,token)).json();assert.equal(read.care.playground,true);assert.equal(read.care.progress.streak,0);
  assert.equal((await call('care','POST',{action:'meal',day,playground:true},token)).status,409);
  const save=await (await call('day?date='+day,'PUT',{revision:0,plan:{start:540,tasks:[{id:'t',name:'A small step',minutes:25,group:'',done:true}]}},token)).json();assert.equal(save.care.playground,true);assert.equal(save.care.progress.streak,1);assert.equal(save.care.progress.xp,10);
  const cared=await (await call('care','POST',{action:'meal',day},token)).json();assert.equal(cared.care.playground,true);assert.equal(cared.care.used,1);
  const other=await (await call('signup','POST',{username:'another',password:'test-password'})).json();assert.equal((await (await call('care','GET',null,other.token)).json()).care.playground,false);
  assert.equal((await call('care')).status,401);
 }finally{db.close();}
});
