// Read-only Google Calendar integration. OAuth finishes in an authenticated POST
// from the original app tab, so this cross-origin Worker needs no third-party cookie.
import {validateDay} from './model.mjs';
const SCOPE='https://www.googleapis.com/auth/calendar.events.readonly';
const AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN='https://oauth2.googleapis.com/token';
const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const unb64=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const digest=async value=>b64(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export const googleReady=env=>!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.SESSION_SECRET);
const redirectURI=request=>`${new URL(request.url).origin}/dog/google/callback`;
async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(`dog-google-v1:${env.SESSION_SECRET}`)),'AES-GCM',false,['encrypt','decrypt']);}
export async function sealTokens(value,env,userId){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(userId)},await key(env),encoder.encode(JSON.stringify(value)));
 return `${b64(iv)}.${b64(ciphertext)}`;
}
export async function openTokens(value,env,userId){
 const [iv,ciphertext]=value.split('.');
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:encoder.encode(userId)},await key(env),unb64(ciphertext))));
}
async function googleFetch(fetcher,url,options={}){return fetcher(url,{...options,signal:AbortSignal.timeout(10000)});}
function returnURL(origin){return `${origin}/`;}
function allowedOrigin(request,env){const origin=request.headers.get('origin');return (env.ALLOWED_ORIGIN||'').split(',').map(s=>s.trim()).includes(origin)?origin:null;}
function redirect(location){return new Response(null,{status:303,headers:{location,'cache-control':'no-store','referrer-policy':'no-referrer'}});}
export async function googleCallback(request,env,reply){
 const url=new URL(request.url),state=url.searchParams.get('state');
 if(!state||state.length>128)return reply({error:'This calendar connection has expired. Try connecting again.'},400);
 const row=await env.DB.prepare('SELECT * FROM dog_google_oauth WHERE state_hash=? AND expires>?').bind(await digest(state),Date.now()).first();
 if(!row)return reply({error:'This calendar connection has expired. Try connecting again.'},400);
 // Only a return origin saved from an authenticated, allowlisted start is used.
 const fragment=new URLSearchParams();
 if(url.searchParams.has('error')){fragment.set('google-result','cancelled');await env.DB.prepare('DELETE FROM dog_google_oauth WHERE state_hash=?').bind(row.state_hash).run();}
 else {const code=url.searchParams.get('code');if(!code||code.length>4096)return reply({error:'Google did not return an authorization code.'},400);fragment.set('google-code',code);fragment.set('google-state',state);}
 return redirect(`${returnURL(row.origin)}#${fragment}`);
}
async function tokensFor(row,env,fetcher){
 let tokens=await openTokens(row.token_blob,env,row.user_id);
 if(tokens.expires>Date.now()+60000)return {...tokens,storedBlob:row.token_blob};
 const response=await googleFetch(fetcher,TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:tokens.refresh_token,grant_type:'refresh_token'})});
 const data=await response.json();
 if(!response.ok){
  if(data.error==='invalid_grant'){await env.DB.prepare('UPDATE dog_google_connections SET reconnect=1 WHERE user_id=? AND token_blob=?').bind(row.user_id,row.token_blob).run();throw new Error('reconnect');}
  throw new Error('unavailable');
 }
 if(typeof data.access_token!=='string')throw new Error('unavailable');
 tokens={...tokens,access_token:data.access_token,refresh_token:data.refresh_token||tokens.refresh_token,expires:Date.now()+(Number(data.expires_in)||3600)*1000};
 // A refresh cannot resurrect a disconnected or replaced connection.
 const storedBlob=await sealTokens(tokens,env,row.user_id);
 const result=await env.DB.prepare('UPDATE dog_google_connections SET token_blob=? WHERE user_id=? AND token_blob=?').bind(storedBlob,row.user_id,row.token_blob).run();
 if(!result.meta.changes)throw new Error('changed');
 return {...tokens,storedBlob};
}
export async function handleGoogle(request,env,{user,tokenHash,body,reply},fetcher=fetch){
 const url=new URL(request.url),path=url.pathname;
 const row=await env.DB.prepare('SELECT * FROM dog_google_connections WHERE user_id=?').bind(user.id).first();
 if(path==='/dog/google/status'&&request.method==='GET')return reply({ready:googleReady(env),connected:!!row,reconnect:!!row?.reconnect});
 if(path==='/dog/google/disconnect'&&request.method==='POST'){
  await env.DB.batch([env.DB.prepare('DELETE FROM dog_google_connections WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM dog_google_oauth WHERE user_id=?').bind(user.id)]);
  if(row&&env.SESSION_SECRET){try{const tokens=await openTokens(row.token_blob,env,user.id);await googleFetch(fetcher,'https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:tokens.refresh_token})});}catch{/* Local access is removed even if Google is unavailable. */}}
  return reply({connected:false});
 }
 if(!googleReady(env))return reply({error:'Google Calendar setup is not finished yet.',setupRequired:true},503);
 if(path==='/dog/google/connect'&&request.method==='POST'){
  const origin=allowedOrigin(request,env);if(!origin)return reply({error:'Open the planner on its website to connect Google.'},403);
  const state=random(),verifier=random();
  await env.DB.batch([env.DB.prepare('DELETE FROM dog_google_oauth WHERE user_id=? OR expires<?').bind(user.id,Date.now()),env.DB.prepare('INSERT INTO dog_google_oauth(state_hash,user_id,session_hash,verifier,origin,expires) VALUES (?,?,?,?,?,?)').bind(await digest(state),user.id,tokenHash,verifier,origin,Date.now()+600000)]);
  const target=new URL(AUTH);target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirectURI(request),response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:await digest(verifier),code_challenge_method:'S256'});
  return reply({url:target.href});
 }
 if(path==='/dog/google/complete'&&request.method==='POST'){
  if(typeof body?.state!=='string'||body.state.length>128||typeof body.code!=='string'||body.code.length>4096)return reply({error:'Invalid calendar connection.'},400);
  const origin=allowedOrigin(request,env);if(!origin)return reply({error:'Open the planner on its website to connect Google.'},403);
  // Atomically consume state; it is bound to both the account and initiating session.
  const pending=await env.DB.prepare('UPDATE dog_google_oauth SET claimed=1 WHERE state_hash=? AND user_id=? AND session_hash=? AND origin=? AND expires>? AND claimed=0 RETURNING *').bind(await digest(body.state),user.id,tokenHash,origin,Date.now()).first();
  if(!pending)return reply({error:'This connection expired or belongs to another login. Connect Google again.'},400);
  try{
   const response=await googleFetch(fetcher,TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectURI(request),code:body.code,code_verifier:pending.verifier,grant_type:'authorization_code'})});
   const data=await response.json();
   if(!response.ok||!data.access_token||!data.refresh_token||!data.scope?.split(' ').includes(SCOPE))return reply({error:'Google Calendar access was not granted. Please connect again and allow read-only calendar access.'},400);
   const tokens={access_token:data.access_token,refresh_token:data.refresh_token,expires:Date.now()+(Number(data.expires_in)||3600)*1000};
   // The initiating app session must still exist (e.g. no logout during consent).
   const saved=await env.DB.prepare('INSERT INTO dog_google_connections(user_id,token_blob,reconnect) SELECT ?,?,0 WHERE EXISTS (SELECT 1 FROM dog_sessions WHERE token_hash=? AND user_id=? AND expires>?) AND EXISTS (SELECT 1 FROM dog_google_oauth WHERE state_hash=? AND claimed=1) ON CONFLICT(user_id) DO UPDATE SET token_blob=excluded.token_blob,reconnect=0').bind(user.id,await sealTokens(tokens,env,user.id),tokenHash,user.id,Date.now(),pending.state_hash).run();
   if(!saved.meta.changes)return reply({error:'Please log in and connect Google again.'},400);
   return reply({connected:true});
  }catch{return reply({error:'Google could not be connected. Please try again.'},502);}
  finally{await env.DB.prepare('DELETE FROM dog_google_oauth WHERE state_hash=?').bind(pending.state_hash).run();}
 }
 if(path==='/dog/google/events'&&request.method==='GET'){
  if(!row)return reply({connected:false,events:[]});
  if(row.reconnect)return reply({connected:true,reconnect:true,events:[]});
  try{
   try{validateDay(url.searchParams.get('date'));}catch{return reply({error:'Choose a valid calendar day.'},400);}
   const from=url.searchParams.get('from'),to=url.searchParams.get('to'),zone=url.searchParams.get('zone');
   const start=Date.parse(from),end=Date.parse(to);
   if(!Number.isFinite(start)||!Number.isFinite(end)||end-start<20*3600000||end-start>28*3600000)return reply({error:'Choose a valid calendar day.'},400);
   try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();}catch{return reply({error:'Choose a valid time zone.'},400);}
   const tokens=await tokensFor(row,env,fetcher),events=[];let pageToken;
   for(let page=0;page<10;page++){
    const target=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    target.search=new URLSearchParams({timeMin:new Date(start).toISOString(),timeMax:new Date(end).toISOString(),timeZone:zone,singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:'250',fields:'nextPageToken,items(id,summary,start,end,status,transparency,htmlLink,attendees(self,responseStatus))',...(pageToken?{pageToken}:{})});
    const response=await googleFetch(fetcher,target.href,{headers:{authorization:`Bearer ${tokens.access_token}`}});
    if(!response.ok){if(response.status===401){await env.DB.prepare('UPDATE dog_google_connections SET reconnect=1 WHERE user_id=? AND token_blob=?').bind(user.id,tokens.storedBlob).run();throw new Error('reconnect');}throw new Error('unavailable');}
    const data=await response.json();
    for(const event of data.items||[]){
     if(event.status==='cancelled'||event.attendees?.some(a=>a.self&&a.responseStatus==='declined'))continue;
     events.push({id:event.id,title:event.summary||'Busy',start:event.start,end:event.end,busy:event.transparency!=='transparent',url:calendarLink(event.htmlLink)});
    }
    pageToken=data.nextPageToken;if(!pageToken)break;
   }
   if(pageToken)throw new Error('unavailable');
   return reply({connected:true,events,updated:Date.now()});
  }catch(error){if(error.message==='reconnect')return reply({connected:true,reconnect:true,events:[]});return reply({error:'Calendar could not refresh. Please try again.'},502);}
 }
 return reply({error:'Not found.'},404);
}
function calendarLink(value){try{const url=new URL(value);return url.protocol==='https:'&&['calendar.google.com','www.google.com'].includes(url.hostname)?url.href:null;}catch{return null;}}
