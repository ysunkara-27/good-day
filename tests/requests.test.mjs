import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleRequests} from '../requests-api.mjs';
test('public request logs validate, persist, separate sites and limit submissions',async()=>{
 const db=new DatabaseSync(':memory:');const env={DB:{prepare(sql){let args=[];return {bind(...values){args=values;return this},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}},async all(){return {results:db.prepare(sql).all(...args)}}};}}};
 const request=(site,idea)=>handleRequests(new Request('https://test/requests?site='+site,idea===undefined?{}:{method:'POST',body:JSON.stringify({idea})}),env);
 try{
 assert.equal((await request('other')).status,400);assert.equal((await request('dog','bad')).status,400);
 assert.equal((await request('dog','A bigger playground')).status,200);
 assert.equal((await (await request('rides')).json()).requests.length,0);
 assert.equal((await (await request('dog')).json()).requests[0].idea,'A bigger playground');
 for(let i=0;i<4;i++)assert.equal((await request('rides','More tracks please '+i)).status,200);
 assert.equal((await request('dog','Another idea')).status,429);
 assert.equal((await request('dog','x'.repeat(5000))).status,413);
 }finally{db.close();}
});
