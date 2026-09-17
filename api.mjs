import {validateDay,validatePlan} from './model.mjs';
import {defaultPet,validatePet} from './pet-profile.mjs';
import {handleGoogle,googleCallback} from './google-calendar.mjs';
import {readGroupColors,validateGroupColor} from './group-colors.mjs';
import {carryForward} from './rollover.mjs';
import {careDay} from './care-model.mjs';
import {readCare,handleCare} from './care-api.mjs';
const encoder=new TextEncoder();
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));}
const equal=(a,b)=>{let difference=a.length^b.length;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;};
export async function handleDog(request,env,headers={}){
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'content-type':'application/json','cache-control':'no-store'}});
 const url=new URL(request.url),path=url.pathname;
 try{
  if(path==='/dog/google/callback'&&request.method==='GET')return googleCallback(request,env,reply);
  if(!['GET','POST','PUT'].includes(request.method))return reply({error:'Method not allowed.'},405);
  let body;
  if(request.method!=='GET'){const raw=await request.text();if(raw.length>40000)return reply({error:'This plan is too large.'},413);try{body=JSON.parse(raw||'{}')}catch{return reply({error:'Invalid request.'},400)}}
  if(['/dog/login','/dog/signup'].includes(path)&&request.method==='POST'){
   const {password}=body,username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
   if(!/^[a-z0-9_-]{3,24}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128)return reply({error:'Use a 3–24 character username (letters, numbers, _ or -) and an 8–128 character password.'},400);
   const now=Date.now(),key=`${request.headers.get('CF-Connecting-IP')||'local'}:${Math.floor(now/900000)}`;
   await env.DB.prepare('INSERT INTO dog_auth_limits(key,attempts,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').bind(key,now+900000).run();
   const limit=await env.DB.prepare('SELECT attempts FROM dog_auth_limits WHERE key=?').bind(key).first();
   if(limit.attempts>20)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
   await env.DB.batch([env.DB.prepare('DELETE FROM dog_auth_limits WHERE expires<?').bind(now),env.DB.prepare('DELETE FROM dog_sessions WHERE expires<?').bind(now)]);
   let user=await env.DB.prepare('SELECT * FROM dog_users WHERE username=?').bind(username).first();
   if(path==='/dog/signup'){
    if(user)return reply({error:'That username is taken. Try another or log in.'},409);
    const pet=validatePet(body.pet);
    const salt=crypto.randomUUID();user={id:crypto.randomUUID(),username};
    const results=await env.DB.batch([
     env.DB.prepare('INSERT OR IGNORE INTO dog_users(id,username,salt,password_hash) VALUES (?,?,?,?)').bind(user.id,username,salt,await passwordHash(password,salt)),
     env.DB.prepare('INSERT INTO dog_profiles(user_id,data) SELECT id,? FROM dog_users WHERE id=?').bind(JSON.stringify(pet),user.id),
    ]);
    if(!results[0].meta.changes)return reply({error:'That username is taken.'},409);
   }else{
    const calculated=await passwordHash(password,user?.salt||'dog-dummy-salt');
    if(!user||!equal(calculated,user.password_hash))return reply({error:'Username or password is incorrect.'},401);
   }
   const token=hex(crypto.getRandomValues(new Uint8Array(32)));
   await env.DB.prepare('INSERT INTO dog_sessions(token_hash,user_id,expires) VALUES (?,?,?)').bind(await digest(token),user.id,now+30*86400000).run();
   return reply({token,username});
  }
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  const tokenHash=await digest(token);
  const user=await env.DB.prepare('SELECT u.id,u.username FROM dog_sessions s JOIN dog_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?').bind(tokenHash,Date.now()).first();
  if(!user)return reply({error:'Please log in to your day.'},401);
  if(path==='/dog/care')return await handleCare(request,env,user,body,reply);
  if(path.startsWith('/dog/google/'))return handleGoogle(request,env,{user,tokenHash,body,reply});
  if(path==='/dog/groups'){
   if(request.method==='PUT'){
    const {name,color}=validateGroupColor(body);
    if(color===null)await env.DB.prepare('DELETE FROM dog_group_colors WHERE user_id=? AND name=?').bind(user.id,name).run();
    else await env.DB.prepare('INSERT INTO dog_group_colors(user_id,name,color) VALUES (?,?,?) ON CONFLICT(user_id,name) DO UPDATE SET color=excluded.color').bind(user.id,name,color).run();
   }else if(request.method!=='GET')return reply({error:'Method not allowed.'},405);
   return reply({groupColors:await readGroupColors(env,user.id)});
  }
  if(path==='/dog/settings'){
   if(request.method==='PUT'){
    if(typeof body.rollover!=='boolean')return reply({error:'Choose whether unfinished tasks carry forward.'},400);
    await env.DB.prepare('INSERT INTO dog_settings(user_id,rollover) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET rollover=excluded.rollover').bind(user.id,Number(body.rollover)).run();
   }else if(request.method!=='GET')return reply({error:'Method not allowed.'},405);
   const settings=await env.DB.prepare('SELECT rollover FROM dog_settings WHERE user_id=?').bind(user.id).first();
   return reply({rollover:settings?.rollover!==0});
  }
  if(path==='/dog/logout'&&request.method==='POST'){await env.DB.prepare('DELETE FROM dog_sessions WHERE token_hash=?').bind(tokenHash).run();return reply({ok:true});}
  if(path==='/dog/profile'&&request.method==='PUT'){
   const pet=validatePet(body.pet);
   await env.DB.prepare('INSERT INTO dog_profiles(user_id,data) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').bind(user.id,JSON.stringify(pet)).run();
   return reply({pet});
  }
  if(path!=='/dog/day')return reply({error:'Not found.'},404);
  const day=validateDay(url.searchParams.get('date'));
  if(request.method==='GET'){
   const zone=url.searchParams.get('zone')||'UTC';
   const carried=day===careDay(zone)?await carryForward(env,user.id,day):{moved:0,pending:0};
   const row=await env.DB.prepare('SELECT data,revision FROM dog_days WHERE user_id=? AND day=?').bind(user.id,day).first();
   const profile=await env.DB.prepare('SELECT data FROM dog_profiles WHERE user_id=?').bind(user.id).first();
   return reply({groupColors:await readGroupColors(env,user.id),carried,care:await readCare(env,user.id,url.searchParams.get('zone')||'UTC',new Date(),user),username:user.username,pet:profile?JSON.parse(profile.data):defaultPet,plan:row?JSON.parse(row.data):null,revision:row?.revision??0});
  }
  if(request.method!=='PUT')return reply({error:'Method not allowed.'},405);
  careDay(url.searchParams.get('zone')||'UTC');
  const plan=validatePlan(body.plan),revision=body.revision;
  if(!Number.isInteger(revision)||revision<0)return reply({error:'Invalid revision.'},400);
  await env.DB.prepare('INSERT OR IGNORE INTO dog_days(user_id,day,data,revision) VALUES (?,?,?,0)').bind(user.id,day,JSON.stringify({start:540,tasks:[]})).run();
  const saved=await env.DB.prepare('UPDATE dog_days SET data=?,revision=revision+1 WHERE user_id=? AND day=? AND revision=?').bind(JSON.stringify(plan),user.id,day,revision).run();
  if(!saved.meta.changes)return reply({error:'This day changed in another tab. Reload the day before editing.'},409);
  return reply({plan,revision:revision+1,care:await readCare(env,user.id,url.searchParams.get('zone')||'UTC',new Date(),user)});
 }catch(error){if(error.message.startsWith('Choose')||error.message.startsWith('Tasks')||error.message.startsWith('A day'))return reply({error:error.message},400);console.error('Dog API request failed',error);return reply({error:'Could not save your day. Please try again.'},500);}
}
