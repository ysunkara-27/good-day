import {careDay,careActions,earnedLevel,careView} from './care-model.mjs';
// Synchronizing from saved plans also recovers earned care if a response was lost.
// Unique receipts retain memories across edits, but only today's actual plan
// determines new unlocks. High-water unlocks never take earned care away.
export async function readCare(env,userId,zone='UTC',now=new Date()){
 const day=careDay(zone,now);
 await env.DB.prepare('INSERT OR IGNORE INTO dog_care_days(user_id,day,unlocked,used) VALUES (?,?,0,0)').bind(userId,day).run();
 const saved=await env.DB.prepare('SELECT data FROM dog_days WHERE user_id=? AND day=?').bind(userId,day).first();
 const tasks=saved?JSON.parse(saved.data).tasks:[];
 const statements=[env.DB.prepare('UPDATE dog_care_days SET unlocked=MAX(unlocked,?) WHERE user_id=? AND day=?').bind(earnedLevel(tasks),userId,day)];
 for(const task of tasks.filter(task=>task.done))statements.push(env.DB.prepare('INSERT OR IGNORE INTO dog_care_receipts(user_id,day,task_id,name,created) VALUES (?,?,?,?,?)').bind(userId,day,task.id,task.name,now.getTime()));
 await env.DB.batch(statements);
 const row=await env.DB.prepare('SELECT * FROM dog_care_days WHERE user_id=? AND day=?').bind(userId,day).first();
 const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM dog_care_receipts WHERE user_id=?').bind(userId).first();
 const memory=await env.DB.prepare('SELECT day,last_action,last_task FROM dog_care_days WHERE user_id=? AND last_action IS NOT NULL ORDER BY last_at DESC LIMIT 1').bind(userId).first();
 return careView(row,tasks,count.count,memory?{day:memory.day,action:memory.last_action,task:memory.last_task}:null);
}
export async function handleCare(request,env,user,body,reply,now=new Date()){
 const url=new URL(request.url),zone=url.searchParams.get('zone')||'UTC';
 const care=await readCare(env,user.id,zone,now);
 if(request.method==='GET')return reply({care});
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 const action=careActions.find(action=>action.id===body?.action);
 if(!action)return reply({error:'Choose a meal, walk, or rest.'},400);
 // The client includes the viewed care day so a stale tab cannot consume a new day.
 if(body.day!==care.day)return reply({error:'A new day has started. Refresh to see today’s care.',care},409);
 const receipt=await env.DB.prepare('SELECT name FROM dog_care_receipts WHERE user_id=? AND day=? ORDER BY created DESC,task_id LIMIT 1').bind(user.id,care.day).first();
 const result=await env.DB.prepare('UPDATE dog_care_days SET used=used|?,last_action=?,last_task=?,last_at=? WHERE user_id=? AND day=? AND unlocked>=? AND (used & ?)=0').bind(action.bit,action.id,receipt?.name||'',now.getTime(),user.id,care.day,action.level,action.bit).run();
 if(!result.meta.changes)return reply({error:care.used&action.bit?'Already cared for today.':'Complete today’s tasks to unlock this care.',care},409);
 return reply({care:await readCare(env,user.id,zone,now),action:action.id});
}
