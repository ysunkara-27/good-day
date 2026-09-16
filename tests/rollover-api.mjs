import assert from 'node:assert/strict';
const base='http://127.0.0.1:8791/dog';
let token;
async function request(path,method='GET',body){const res=await fetch(`${base}/${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return{status:res.status,data:await res.json()};}
const signup=await request('signup','POST',{username:`roll_${Date.now()}`,password:'local-test-password'});assert.equal(signup.status,200);token=signup.data.token;
const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
const path=date=>`day?date=${date}&zone=UTC`;
const plan={start:540,tasks:[{id:'unfinished',name:'Carry me',minutes:30,group:'Work',done:false,scheduledStart:900},{id:'finished',name:'Keep me',minutes:30,group:'Work',done:true}]};
assert.equal((await request(path(yesterday),'PUT',{plan,revision:0})).status,200);
const next=await request(path(today));assert.equal(next.status,200);assert.equal(next.data.carried.moved,1);assert.equal(next.data.plan.tasks[0].name,'Carry me');assert.equal(next.data.plan.tasks[0].scheduledStart,undefined);
assert.equal((await request(path(today))).data.carried.moved,0);assert.equal((await request(path(yesterday))).data.plan.tasks.length,1);
assert.equal((await request(path(yesterday),'PUT',{plan,revision:1})).status,409);
assert.equal((await request('settings','PUT',{rollover:false})).status,200);assert.equal((await request('settings')).data.rollover,false);
const previous=await request(path(yesterday));assert.equal((await request(path(yesterday),'PUT',{plan,revision:previous.data.revision})).status,200);assert.equal((await request(path(today))).data.carried.moved,0);
console.log('PASS: local carryover API, idempotence, stale revision protection, settings persistence.');
