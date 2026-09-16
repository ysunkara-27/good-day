import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleGoogle,googleCallback,sealTokens,openTokens} from '../google-calendar.mjs';
import {handleDog} from '../api.mjs';
import {calendarRows} from '../calendar-model.mjs';
import {schedule} from '../model.mjs';
const APP='http://127.0.0.1:8095',API='http://127.0.0.1:8791',scope='https://www.googleapis.com/auth/calendar.events.readonly';
const reply=(data,status=200)=>Response.json(data,{status});
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};},async batch(statements){return Promise.all(statements.map(statement=>statement.run()));}};
 for(const id of ['one','two']){sqlite.prepare('INSERT INTO dog_users VALUES (?,?,?,?)').run(id,id,'salt','hash');sqlite.prepare('INSERT INTO dog_sessions VALUES (?,?,?)').run(`session-${id}`,id,Date.now()+600000);}
 const env={DB,GOOGLE_CLIENT_ID:'fixture-client',GOOGLE_CLIENT_SECRET:'fixture-secret',SESSION_SECRET:'fixture-encryption-key',ALLOWED_ORIGIN:APP};
 let fetcher=async()=>{throw new Error('Unexpected provider request');};
 const request=(path,method='GET',body,user='one',origin=APP)=>handleGoogle(new Request(`${API}/dog/google/${path}`,{method,headers:{origin}}),env,{user:{id:user},tokenHash:`session-${user}`,body,reply},(...args)=>fetcher(...args));
 return {DB,env,request,provider(fn){fetcher=fn;},close(){sqlite.close();}};
}
async function begin(f){const res=await f.request('connect','POST',{});assert.equal(res.status,200);return new URL((await res.json()).url);}
const tokens=()=>({access_token:'fixture-access-token',refresh_token:'fixture-refresh-token',expires_in:3600,scope});
const eventsPath='events?date=2026-09-16&from=2026-09-16T04%3A00%3A00Z&to=2026-09-17T04%3A00%3A00Z&zone=America%2FNew_York';

test('OAuth is read-only, PKCE protected, account/session bound, one-time and encrypted',async()=>{
 const f=fixture();try{
  const target=await begin(f),state=target.searchParams.get('state');
  assert.equal(target.origin,'https://accounts.google.com');assert.equal(target.searchParams.get('scope'),scope);assert.equal(target.searchParams.get('code_challenge_method'),'S256');
  assert.equal(target.searchParams.get('redirect_uri'),`${API}/dog/google/callback`);
  const callback=await googleCallback(new Request(`${API}/dog/google/callback?state=${state}&code=fixture-code&returnTo=https://evil.example`),f.env,reply);
  const location=new URL(callback.headers.get('location'));assert.equal(location.origin,APP);assert.equal(location.pathname,'/');assert.equal(new URLSearchParams(location.hash.slice(1)).get('google-code'),'fixture-code');
  const pending=await f.DB.prepare('SELECT * FROM dog_google_oauth').first();
  assert.equal((await f.request('complete','POST',{state,code:'fixture-code'},'two')).status,400);
  let exchanges=0;
  f.provider(async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.body.get('code_verifier'),pending.verifier);exchanges++;return Response.json(tokens());});
  assert.equal((await f.request('complete','POST',{state,code:'fixture-code'})).status,200);
  const connection=await f.DB.prepare('SELECT * FROM dog_google_connections WHERE user_id=?').bind('one').first();
  assert(!connection.token_blob.includes('fixture'));assert.equal((await openTokens(connection.token_blob,f.env,'one')).refresh_token,'fixture-refresh-token');
  await assert.rejects(()=>openTokens(connection.token_blob,f.env,'two'));
  assert.equal((await f.request('complete','POST',{state,code:'fixture-code'})).status,400);assert.equal(exchanges,1);
  assert.equal((await (await f.request('status','GET',null,'two')).json()).connected,false);
 }finally{f.close();}
});
test('missing configuration, hostile origins, expired state, and denied consent fail safely',async()=>{
 const f=fixture();try{
  assert.equal((await f.request('connect','POST',{},'one','https://evil.example')).status,403);
  const target=await begin(f),state=target.searchParams.get('state');
  const denied=await googleCallback(new Request(`${API}/dog/google/callback?state=${state}&error=access_denied`),f.env,reply);
  assert(denied.headers.get('location').endsWith('#google-result=cancelled'));
  assert.equal((await f.request('complete','POST',{state,code:'unused'})).status,400);
  const expired=await begin(f);await f.DB.prepare('UPDATE dog_google_oauth SET expires=0').run();
  assert.equal((await googleCallback(new Request(`${API}/dog/google/callback?state=${expired.searchParams.get('state')}&code=x`),f.env,reply)).status,400);
  delete f.env.GOOGLE_CLIENT_ID;
  assert.equal((await f.request('connect','POST',{})).status,503);
  assert.equal((await (await f.request('status')).json()).ready,false);
  const noAuth=await handleDog(new Request(`${API}/dog/google/status`),f.env);assert.equal(noAuth.status,401);
 }finally{f.close();}
});
test('disconnect during consent exchange cannot recreate the connection',async()=>{
 const f=fixture();try{
  const target=await begin(f),state=target.searchParams.get('state');
  f.provider(async()=>{await f.request('disconnect','POST',{});return Response.json(tokens());});
  assert.equal((await f.request('complete','POST',{state,code:'fixture-code'})).status,400);
  assert.equal((await (await f.request('status')).json()).connected,false);
 }finally{f.close();}
});
test('event reads expand recurrence, paginate, filter declined/cancelled, and never write Google events',async()=>{
 const f=fixture();try{
  await f.DB.prepare('INSERT INTO dog_google_connections VALUES (?,?,0)').bind('one',await sealTokens({...tokens(),expires:Date.now()+3600000},f.env,'one')).run();
  let calls=0;
  f.provider(async(url,options)=>{
   const target=new URL(url);assert.equal(target.pathname,'/calendar/v3/calendars/primary/events');assert.equal(options.method,undefined);assert.equal(target.searchParams.get('singleEvents'),'true');assert.equal(target.searchParams.get('fields'),'nextPageToken,items(id,summary,start,end,status,transparency,htmlLink,attendees(self,responseStatus))');assert.equal(options.headers.authorization,'Bearer fixture-access-token');calls++;
   return Response.json(calls===1?{items:[{id:'meeting',summary:'Meeting',start:{dateTime:'2026-09-16T09:00:00-04:00'},end:{dateTime:'2026-09-16T10:00:00-04:00'},htmlLink:'https://calendar.google.com/calendar/event?eid=fixture'},{id:'cancelled',status:'cancelled'},{id:'declined',attendees:[{self:true,responseStatus:'declined'}]}],nextPageToken:'next'}:{items:[{id:'free',summary:'Reminder',transparency:'transparent',start:{date:'2026-09-16'},end:{date:'2026-09-17'},htmlLink:'javascript:alert(1)'}]});
  });
  const data=await (await f.request(eventsPath)).json();assert.equal(calls,2);assert.deepEqual(data.events.map(e=>e.id),['meeting','free']);assert.equal(data.events[1].busy,false);assert.equal(data.events[1].url,null);
  assert.equal((await (await f.request(eventsPath,'GET',null,'two')).json()).connected,false);
  assert.equal((await f.request('events?date=nope')).status,400);
 }finally{f.close();}
});
test('expired access tokens refresh; revoked grants request reconnection; disconnect deletes credentials',async()=>{
 const f=fixture();try{
  const blob=await sealTokens({...tokens(),expires:0},f.env,'one');await f.DB.prepare('INSERT INTO dog_google_connections VALUES (?,?,0)').bind('one',blob).run();
  const calls=[];f.provider(async(url,options)=>{calls.push(url);if(url.includes('/token')){assert.equal(options.body.get('grant_type'),'refresh_token');return Response.json({access_token:'refreshed',expires_in:3600});}return Response.json({items:[]});});
  assert.equal((await f.request(eventsPath)).status,200);assert.equal(calls.length,2);
  const refreshed=await f.DB.prepare('SELECT * FROM dog_google_connections').first();assert.notEqual(refreshed.token_blob,blob);
  await f.DB.prepare('UPDATE dog_google_connections SET token_blob=?').bind(blob).run();
  f.provider(async()=>Response.json({error:'invalid_grant'},{status:400}));
  assert.equal((await (await f.request(eventsPath)).json()).reconnect,true);
  assert.equal((await (await f.request('status')).json()).reconnect,true);
  f.provider(async(url)=>{assert.equal(url,'https://oauth2.googleapis.com/revoke');return new Response(null,{status:200});});
  assert.equal((await f.request('disconnect','POST',{})).status,200);
  assert.equal((await (await f.request('status')).json()).connected,false);
 }finally{f.close();}
});
test('calendar adapter clips multi-day events, excludes end-exclusive all-day events, and schedules around busy events',()=>{
 const rows=calendarRows([
  {id:'meeting',title:'Meeting',busy:true,start:{dateTime:'2026-09-16T09:00:00-04:00'},end:{dateTime:'2026-09-16T10:00:00-04:00'}},
  {id:'overnight',busy:true,start:{dateTime:'2026-09-15T23:00:00-04:00'},end:{dateTime:'2026-09-16T01:00:00-04:00'}},
  {id:'all-day',start:{date:'2026-09-16'},end:{date:'2026-09-17'}},
  {id:'invalid',start:{dateTime:'invalid'},end:{dateTime:'invalid'}},
  {id:'yesterday',start:{date:'2026-09-15'},end:{date:'2026-09-16'}},
 ],'2026-09-16','America/New_York');
 assert.deepEqual(rows.map(e=>e.id),['meeting','overnight','all-day']);assert.equal(rows[1].start,0);assert.equal(rows[1].end,60);
 const task={id:'a',name:'Read',minutes:30,group:'',done:false};
 const result=schedule({start:540,tasks:[task]},rows.filter(e=>e.busy&&!e.allDay));assert.equal(result[0].start,600);
 assert.equal(schedule({start:540,tasks:[{...task,scheduledStart:555}]},rows.filter(e=>e.busy&&!e.allDay))[0].overlap,true);
 const dst=calendarRows([{id:'dst',start:{dateTime:'2026-11-01T01:30:00-04:00'},end:{dateTime:'2026-11-01T01:15:00-05:00'}}],'2026-11-01','America/New_York');assert(dst[0].end>dst[0].start);
});
