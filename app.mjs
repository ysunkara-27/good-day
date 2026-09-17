import {mountFeatureLog} from './feature-log.mjs';
import {mountClubhouse} from './clubhouse.mjs';
import {hourlyQuote} from './progression.mjs';
import {localDay,progress,timeLabel,clockMinutes,clockValue} from './model.mjs';
import {defaultPet} from './pet-profile.mjs';
import {createCompanion,puppySVG} from './pet.mjs';
import {calendarRows,calendarWindow} from './calendar-model.mjs';
import {groupPalette,groupKey,groupColor} from './group-colors.mjs';
import {buildAgenda} from './agenda.mjs';
const $=id=>document.getElementById(id);
const API=['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:8791':'https://hooraas-rides-api.sunkarayashaswi.workers.dev';
mountFeatureLog({site:'dog',api:API,host:document.querySelector('.legal-footer nav')});
let token=localStorage.getItem('good-day-token')||'',username='',day=localDay(),revision=0,plan={start:540,tasks:[]},busy=false,signup=false,editId=null,focusId=null,remaining=1500,deadline=null,timerLength=1500,noticeTimeout,loadSequence=0;
let knownToday=localDay();
let pet={...defaultPet},care=null,careBusy=false;
const zone=()=>encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
let calendar={ready:false,connected:false,reconnect:false,events:[],updated:null,error:'',loading:false};
let agendaView='all',groupColors={},groupColorBusy=false;
let calendarSequence=0,lastCalendarAttempt=0,googleBusy=false,lastCareRefresh=0;
const googleReturn=new URLSearchParams(location.hash.slice(1));
if(googleReturn.has('google-code')||googleReturn.has('google-result'))history.replaceState(null,'',location.pathname+location.search);
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function notice(message,persistent=false){clearTimeout(noticeTimeout);$('notice').textContent=message;$('notice').hidden=false;if(!persistent)noticeTimeout=setTimeout(()=>$('notice').hidden=true,5000);}
async function api(path,method='GET',body){let response;try{response=await fetch(`${API}/dog/${path}`,{method,headers:{...(token?{authorization:`Bearer ${token}`} :{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});}catch{throw new Error('Couldn’t connect. Your changes haven’t been saved. Please try again.');}let data;try{data=await response.json()}catch{throw new Error('The planner is unavailable. Please try again.');}if(!response.ok){if(response.status===401&&!['login','signup'].includes(path)){token='';localStorage.removeItem('good-day-token');showAuth();}if(response.status===409&&path.startsWith('day')){$('reload').hidden=false;}throw new Error(data.error||'Something went wrong. Please try again.');}return data;}
function setBusy(value){busy=value;for(const element of document.querySelectorAll('#workspace button,#workspace input,#workspace textarea,#workspace select,#task-form button,#task-form input,#task-form textarea,#focus button,#focus input,#focus select,#day,#today,#account,#edit-form button,#edit-form input,#focus-done'))element.disabled=value;$('timer-minutes').disabled=value||!!deadline;if(!value)renderCare();}
function showAuth(){
 loadSequence++;agendaView='all';groupColors={};setBusy(false);signup=false;updateAuthMode();
 clubhouse.close();$('edit-dialog').close();$('pet-dialog').close();$('account-dialog').close();calendarSequence++;calendar={ready:false,connected:false,reconnect:false,events:[],updated:null,error:'',loading:false};$('loading').hidden=true;$('auth').hidden=false;
 $('workspace').hidden=true;$('account').hidden=true;$('date-control').hidden=true;$('reload').hidden=true;$('load-error').hidden=true;
 care=null;resetTimer();plan={start:540,tasks:[]};pet={...defaultPet};companion.setProfile(pet);
 renderDog();renderFocus();$('date-label').textContent='';$('page-title').textContent='Your day.';
}
async function loadDay(){
 const sequence=++loadSequence,recovering=!$('load-error').hidden;
 $('load-error').hidden=true;$('reload').hidden=true;$('loading').hidden=false;$('workspace').hidden=true;$('auth').hidden=true;setBusy(true);
 try{
  const data=await api(`day?date=${day}&zone=${zone()}`);if(sequence!==loadSequence)return;
  care=data.care;groupColors=data.groupColors||{};username=data.username;revision=data.revision;pet={...defaultPet,...data.pet};companion.setProfile(pet);
  const now=new Date();plan=data.plan||{start:day===localDay()?Math.min(1425,Math.max(540,Math.ceil((now.getHours()*60+now.getMinutes())/15)*15)):540,tasks:[]};
  $('workspace').hidden=false;$('account').hidden=false;$('account').textContent='Account';$('account').title=`Signed in as ${username}`;$('date-control').hidden=false;
  if(recovering)$('notice').hidden=true;
  restoreDraft();render();loadCalendar();
  if(data.carried?.moved)notice(`${data.carried.moved} unfinished ${data.carried.moved===1?'task moved':'tasks moved'} into today.`);
  if(data.carried?.pending)notice(`${data.carried.pending} unfinished tasks remain on earlier days. Today is at its 100-task limit.`,true);
 }catch(error){
  if(sequence===loadSequence&&token){$('load-error').hidden=false;$('notice').hidden=true;}
  else if(!token)notice(error.message,true);
 }finally{if(sequence===loadSequence){$('loading').hidden=true;setBusy(false);}}
}
async function save(next){if(busy)return false;setBusy(true);try{const data=await api(`day?date=${day}&zone=${zone()}`,'PUT',{plan:next,revision});plan=data.plan;revision=data.revision;care=data.care;render();return true;}catch(error){notice(error.message,true);return false;}finally{setBusy(false);}}
function renderDog(){
 const done=plan.tasks.filter(t=>t.done).length,pct=progress(plan.tasks);
 $('percent').textContent=`${pct}%`;$('completed-label').textContent=`${done} of ${plan.tasks.length} done`;
 $('progress-fill').style.width=`${pct}%`;$('progress').setAttribute('aria-valuenow',pct);
 companion.setProgress(done);renderCare();
}
function render(){const today=day===localDay(),date=new Date(`${day}T12:00:00`);$('day').value=day;$('date-label').textContent=date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();$('page-title').textContent=today?'Today.':date.toLocaleDateString(undefined,{month:'short',day:'numeric'});$('start').value=`${String(Math.floor(plan.start/60)).padStart(2,'0')}:${String(plan.start%60).padStart(2,'0')}`;
 const total=plan.tasks.reduce((sum,t)=>sum+t.minutes,0);$('plan-summary').textContent=plan.tasks.length?`${plan.tasks.length} ${plan.tasks.length===1?'task':'tasks'} · ${total>=60?`${Math.floor(total/60)}h `:''}${total%60?`${total%60}m `:''}planned`:'';
 if(!calendar.connected)agendaView='all';
 const {scheduled,allDay,rows}=buildAgenda(plan,calendar.events,day,Intl.DateTimeFormat().resolvedOptions().timeZone,agendaView);
 $('all-day-events').hidden=!allDay.length;
 $('all-day-events').innerHTML=allDay.map(event=>`<div class="all-day-event"><span>All day</span> ${event.url?`<a href="${escape(event.url)}" target="_blank" rel="noopener noreferrer">${escape(event.title)} ↗</a>`:escape(event.title)} <small>Google Calendar · Does not block tasks</small></div>`).join('');
 const next=scheduled.find(t=>!t.done)?.id;
 $('timeline').innerHTML=rows.map(task=>{if(task.calendarEvent)return renderCalendarEvent(task);const {paper,accent}=groupColor(task.group,groupColors);return `<article class="task-row ${task.done?'done':''}"><div class="task-time"><button data-time="${task.id}" aria-label="Change start time for ${escape(task.name)}">${timeLabel(task.start).replace(' +','<br>+')}${task.fixed?'<span class="fixed-mark">set</span>':''}</button></div><div class="task-card" style="--paper:${paper};--accent:${accent};min-height:${Math.min(190,90+task.minutes*.5)}px"><button class="check" data-complete="${task.id}" role="checkbox" aria-checked="${task.done}" aria-label="${task.done?'Mark incomplete:':'Complete:'} ${escape(task.name)}">${task.done?'✓':''}</button><div class="task-content"><div class="task-title">${escape(task.name)}</div><div class="task-meta">${task.group?`<span class="group-chip">${escape(task.group)}</span>`:''}<span>${task.minutes} min</span><span>until ${timeLabel(task.end)}</span>${task.overlap?'<span class="overlap-chip">Time overlap</span>':''}${task.id===next?'<span class="next-chip">Up next</span>':''}</div></div><div class="task-actions">${!task.done?`<button data-focus="${task.id}" aria-label="Start timer for ${escape(task.name)}">▷ Start</button>`:''}<button data-edit="${task.id}" aria-label="Edit ${escape(task.name)}">···</button></div></div></article>`;}).join('');
 $('empty').hidden=!!rows.length||!!allDay.length;
 $('agenda-empty').textContent=agendaView==='calendar'?(calendar.loading?'Loading calendar events…':calendar.error||calendar.reconnect?'Calendar events are unavailable. Check the connection above.':'No Google events on this day.'):agendaView==='tasks'?'No tasks on this day. Add one to plan around your events.':'Add a task to start your day.';
 document.querySelectorAll('[data-agenda]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.agenda===agendaView)));
 renderCalendarStatus();
 $('groups').innerHTML=[...new Set(['Work','Life','Me time',...plan.tasks.map(t=>t.group).filter(Boolean),...Object.keys(groupColors)])].map(group=>`<option value="${escape(group)}">`).join('');
 if(focusId&&!plan.tasks.some(t=>t.id===focusId&&!t.done)){resetTimer();}renderDog();renderFocus();syncGroupColor();syncGroupColor('edit-');requestAnimationFrame(()=>companion.settle());}
async function complete(id){const task=plan.tasks.find(t=>t.id===id);if(!task)return;const wasDone=task.done;if(await save({...plan,tasks:plan.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)})){if(!wasDone&&day===localDay())companion.taskCompleted(id);}}
function resetTimer(id=null){
 focusId=id;deadline=null;
 timerLength=(plan.tasks.find(task=>task.id===id)?.minutes||25)*60;
 remaining=timerLength;
}
function renderFocus(){
 $('focus-task').innerHTML='<option value="">Just a timer</option>'+plan.tasks.filter(task=>!task.done).map(task=>`<option value="${task.id}">${escape(task.name)}</option>`).join('');
 $('focus-task').value=focusId||'';
 $('timer-minutes').value=timerLength/60;
 $('focus-done').hidden=!focusId;
 tick();
}
function tick(){
 if(deadline){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));if(!remaining){deadline=null;notice('Timer finished.');}}
 companion.setFocus(!!deadline);
 $('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
 $('timer-toggle').textContent=deadline?'Pause':remaining===0?'Start again':remaining===timerLength?'Start':'Resume';
 $('timer-minutes').disabled=busy||!!deadline;
 $('focus-hint').textContent=remaining===0?'Time’s up.':deadline?'Running':remaining!==timerLength?'Paused':'';
}
function selectTimer(id,start=false){
 if(focusId!==id||!remaining)resetTimer(id);
 if(start&&!deadline)deadline=Date.now()+remaining*1000;
 renderFocus();
}
function editTask(id,atTime=false){
 editId=id;const task=plan.tasks.find(task=>task.id===id);
 $('edit-name').value=task.name;$('edit-minutes').value=task.minutes;
 $('edit-group').value=task.group;$('edit-start').value=clockValue(task.scheduledStart);
 syncGroupColor('edit-');$('edit-dialog').showModal();if(atTime)$('edit-start').focus();
}
function updateAuthMode(){
 $('auth-submit').textContent=signup?'Create account →':'Log in →';
 $('auth-title').textContent=signup?'Create an account':'Log in';
 $('auth-switch').textContent=signup?'Already have an account? Log in':'New here? Create an account';
 $('password').autocomplete=signup?'new-password':'current-password';$('signup-pet').hidden=!signup;
 if(signup)previewSignup();
}
function signupPet(){return {name:$('signup-pet-name').value.trim()||'Biscuit',coat:document.querySelector('[name="signup-coat"]:checked').value,collar:document.querySelector('[name="signup-collar"]:checked').value,roaming:true};}
function previewSignup(){const candidate=signupPet();$('signup-preview').innerHTML=puppySVG(candidate);}
$('signup-pet').addEventListener('input',previewSignup);
$('auth-switch').onclick=()=>{signup=!signup;updateAuthMode();};
$('auth-form').onsubmit=async event=>{event.preventDefault();$('auth-submit').disabled=true;try{const data=await api(signup?'signup':'login','POST',{username:$('username').value,password:$('password').value,...(signup?{pet:signupPet()}:{})});token=data.token;localStorage.setItem('good-day-token',token);$('password').value='';$('notice').hidden=true;const created=signup;await loadDay();if(created&&!$('workspace').hidden)openAccount(true);}catch(error){notice(error.message,true);}finally{$('auth-submit').disabled=false;}};
$('logout').onclick=async()=>{setBusy(true);try{await api('logout','POST',{});token='';localStorage.removeItem('good-day-token');showAuth();notice('Logged out.');}catch(error){notice(error.message);}finally{setBusy(false);}};
function updateComposer(){
 const count=$('task-name').value.split(/\r?\n/).filter(line=>line.trim()).length;
 $('add-task').textContent=count>1?`+ Add ${count} tasks`:'+ Add task';
 $('batch-time-hint').hidden=count<2||!$('task-start').value;
 document.querySelectorAll('[data-minutes]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.minutes)===Number($('duration').value))));
}
function syncGroupColor(prefix=''){
 const name=$(prefix+'group').value.trim(),select=$(prefix+'group-color');
 const color=groupColor(name,groupColors);select.style.backgroundColor=color.paper;select.style.borderColor=color.accent;
 select.value=Object.hasOwn(groupColors,groupKey(name))?groupColors[groupKey(name)]:'';select.disabled=!name||groupColorBusy;
}
for(const prefix of ['', 'edit-']){
 const select=$(prefix+'group-color');select.innerHTML='<option value="">Automatic</option>'+Object.entries(groupPalette).map(([value,color])=>`<option value="${value}">${color.label}</option>`).join('');
 $(prefix+'group').addEventListener('input',()=>{$(prefix+'group-color-status').textContent='';syncGroupColor(prefix);});
 select.onchange=async()=>{
  const name=$(prefix+'group').value.trim(),color=select.value||null,session=token;
  if(!name||groupColorBusy)return;groupColorBusy=true;syncGroupColor();syncGroupColor('edit-');
  $(prefix+'group-color-status').textContent='Saving…';
  try{const data=await api('groups','PUT',{name,color});if(token!==session)return;groupColors=data.groupColors;render();$(prefix+'group-color-status').textContent='Group color saved.';}
  catch(error){if(token===session)$(prefix+'group-color-status').textContent=error.message;}
  finally{groupColorBusy=false;syncGroupColor();syncGroupColor('edit-');}
 };
 syncGroupColor(prefix);
}
$('duration').oninput=updateComposer;
$('task-start').oninput=updateComposer;
$('clear-task-start').onclick=()=>{$('task-start').value='';updateComposer();};
$('clear-edit-start').onclick=()=>{$('edit-start').value='';};
$('task-name').oninput=updateComposer;
$('task-name').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!busy)$('task-form').requestSubmit();}};
for(const button of document.querySelectorAll('[data-minutes]'))button.onclick=()=>{$('duration').value=button.dataset.minutes;updateComposer();};
$('task-form').onsubmit=async event=>{
 event.preventDefault();
 const names=$('task-name').value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(!names.length)return;
 if(names.some(name=>name.length>160)){notice('Keep each task under 160 characters.');return;}
 if(names.length+plan.tasks.length>100){notice('A day can hold up to 100 tasks.');return;}
 const at=clockMinutes($('task-start').value),minutes=Number($('duration').value);
 if(at!=null&&at+(names.length-1)*minutes>1439){notice('These tasks extend into tomorrow. Add the remaining tasks on that day.');return;}
 const tasks=names.map((name,index)=>({id:crypto.randomUUID(),name,minutes,group:$('group').value.trim(),done:false,...(at==null?{}:{scheduledStart:at+index*minutes})}));
 if(await save({...plan,tasks:[...plan.tasks,...tasks]})){$('task-name').value='';$('task-start').value='';$('task-time-details').open=false;updateComposer();companion.taskAdded(tasks.at(-1).id);}
};
$('start').onchange=async()=>{const [hours,minutes]=$('start').value.split(':').map(Number);if(!Number.isFinite(hours)||!Number.isFinite(minutes)){render();return;}if(!await save({...plan,start:hours*60+minutes}))render();};
$('timeline').onclick=event=>{
 const button=event.target.closest('button');if(!button||busy)return;
 if(button.dataset.complete)complete(button.dataset.complete);
 if(button.dataset.focus){selectTimer(button.dataset.focus,true);$('focus').scrollIntoView({behavior:'smooth',block:'nearest'});$('timer-toggle').focus({preventScroll:true});}
 if(button.dataset.edit)editTask(button.dataset.edit);
 if(button.dataset.time)editTask(button.dataset.time,true);
};
$('open-timer').onclick=()=>{$('focus').scrollIntoView({behavior:'smooth',block:'nearest'});$('timer-toggle').focus({preventScroll:true});};
$('focus-task').onchange=()=>{resetTimer($('focus-task').value||null);renderFocus();};
$('timer-minutes').onchange=()=>{if(!$('timer-minutes').checkValidity())return;deadline=null;timerLength=Number($('timer-minutes').value)*60;remaining=timerLength;tick();};
$('timer-toggle').onclick=()=>{
 if(deadline){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));deadline=null;}
 else{
  if(!$('timer-minutes').reportValidity())return;
  if(!remaining)remaining=timerLength;
  deadline=Date.now()+remaining*1000;
 }
 tick();
};
$('timer-reset').onclick=()=>{deadline=null;remaining=timerLength;renderFocus();};$('focus-done').onclick=()=>complete(focusId);
$('cancel-edit').onclick=()=>$('edit-dialog').close();
$('edit-form').onsubmit=async event=>{event.preventDefault();if(!$('edit-name').value.trim())return;const tasks=plan.tasks.map(t=>t.id===editId?{...t,name:$('edit-name').value.trim(),minutes:Number($('edit-minutes').value),group:$('edit-group').value.trim(),scheduledStart:clockMinutes($('edit-start').value)}:t);if(await save({...plan,tasks}))$('edit-dialog').close();};
$('delete-task').onclick=async()=>{if(await save({...plan,tasks:plan.tasks.filter(t=>t.id!==editId)})){$('edit-dialog').close();notice('Task removed.');}};
async function changeDay(value){if(!value||busy)return;day=value;calendarSequence++;calendar.events=[];calendar.updated=null;calendar.error='';resetTimer();renderFocus();await loadDay();}
$('day').onchange=()=>changeDay($('day').value);$('today').onclick=()=>changeDay(localDay());$('reload').onclick=()=>loadDay();
$('retry-load').onclick=()=>loadDay();
window.addEventListener('online',()=>{if(token&&!busy&&!$('load-error').hidden)loadDay();});
setInterval(()=>{tick();const current=localDay();if(current!==knownToday&&!busy){const wasToday=day===knownToday;knownToday=current;if(wasToday&&token){notice('Showing today. Previous days are in the date picker.');changeDay(current);}}},500);
function openPet(){
 $('pet-name').value=pet.name;$('pet-coat').value=pet.coat;$('pet-collar').value=pet.collar;
 $('pet-rest').textContent=pet.roaming?'Pause wandering':'Let wander';
 $('pet-feedback').textContent='';$('pet-dialog-preview').innerHTML=puppySVG(pet);
 renderCare();$('pet-dialog').showModal();
}
const companion=createCompanion({onOpen:openPet});
const clubhouse=mountClubhouse({getState:()=>({pet,care}),serveMeal:()=>performCare('meal',true),savePet});
$('open-club').onclick=()=>{$('pet-dialog').close();clubhouse.open('play');};
$('club-shortcut').onclick=()=>clubhouse.open('play');
function renderQuote(){document.querySelectorAll('.hourly-quote').forEach(el=>el.textContent=hourlyQuote());}
function scheduleQuote(){renderQuote();setTimeout(scheduleQuote,3600000-Date.now()%3600000);}
scheduleQuote();document.addEventListener('visibilitychange',renderQuote);
$('pet-menu').onclick=openPet;
$('close-pet').onclick=()=>$('pet-dialog').close();
$('pet-dialog').addEventListener('click',event=>{if(event.target===$('pet-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
function renderCare(){
 $('care-card').hidden=!care;clubhouse.render();
 companion.setCare(care);
 $('care-name').textContent=pet.name;
 const next=care?.needs.find(n=>!n.done),ready=care?.needs.filter(n=>n.ready).length||0;
 const summary=!care?'Complete today’s tasks to care for your dog.':next?(next.ready?`${next.title} is ready.`:`${next.need} · ${next.remaining} more ${next.remaining===1?'task':'tasks'} to ${next.title.toLowerCase()}.`):'Fed, exercised, and cozy.';
 $('care-summary').textContent=summary;$('pet-need-summary').textContent=summary;
 $('care-badge').textContent=ready?`${ready} ready`:'Today';
 $('care-needs').innerHTML=(care?.needs||[]).map(n=>`<span class="${n.done?'satisfied':n.ready?'ready':''}">${n.done?'✓ ':''}${n.title}</span>`).join('');
 $('care-next').textContent=next?next.verb:'All cared for';$('care-next').disabled=!next?.ready||careBusy;
 $('care-next').onclick=()=>{if(next?.id==='meal')clubhouse.open('meal');else if(next)performCare(next.id);};
 $('pet-care-actions').innerHTML=(care?.needs||[]).map(n=>`<button type="button" data-care="${n.id}" ${!n.ready||careBusy?'disabled':''}><span>${n.done?'✓ '+n.satisfied:n.verb}</span><small>${n.done?'Done today':n.ready?'Ready':n.level===1?'Finish your first task':n.level===2?'Finish half your tasks':'Finish your plan'}</small></button>`).join('');
 $('pet-memory').textContent=care?.last?.task?`Last ${care.last.action}: after “${care.last.task}”.`:'';
 $('pet-trick').disabled=!care?.tricks.length;
 $('pet-trick').textContent=care?.tricks.length?`Ask for a trick · ${care.tricks.join(', ')}`:`Learn paw · ${Math.max(0,3-(care?.lifetime||0))} tasks to go`;
}
async function performCare(action,keepOpen=false){
 if(careBusy||!care)return;careBusy=true;renderCare();
 try{const data=await api(`care?zone=${zone()}`,'POST',{action,day:care.day});care=data.care;renderCare();if(!keepOpen)$('pet-dialog').close();requestAnimationFrame(()=>companion.performCare(action));return true;}
 catch(error){notice(error.message);try{care=(await api(`care?zone=${zone()}`)).care;}catch{}}
 finally{careBusy=false;renderCare();}
}
$('pet-care-actions').onclick=event=>{const button=event.target.closest('[data-care]');if(button&&!button.disabled){if(button.dataset.care==='meal'){$('pet-dialog').close();clubhouse.open('meal');}else performCare(button.dataset.care);}};
$('care-open').onclick=openPet;
$('pet-call').onclick=()=>{$('pet-dialog').close();companion.call();};
$('pet-trick').onclick=()=>{$('pet-dialog').close();companion.trick();};
async function savePet(next){
 const controls=[...$('pet-dialog').querySelectorAll('input,select,button')];controls.forEach(control=>control.disabled=true);
 try{if(token){const data=await api('profile','PUT',{pet:next});pet=data.pet;}else pet=next;
  companion.setProfile(pet);$('pet-rest').textContent=pet.roaming?'Pause wandering':'Let wander';return true;
 }catch(error){$('pet-feedback').textContent=error.message;return false;}
 finally{controls.forEach(control=>control.disabled=false);renderCare();}
}
$('pet-rest').onclick=()=>savePet({...pet,roaming:!pet.roaming});
$('pet-form').onsubmit=async event=>{event.preventDefault();if(await savePet({...pet,name:$('pet-name').value.trim(),coat:$('pet-coat').value,collar:$('pet-collar').value})){$('pet-customize').open=false;$('pet-feedback').textContent='Saved.';}};
for(const id of ['pet-coat','pet-collar'])$(id).onchange=()=>{$('pet-dialog-preview').innerHTML=puppySVG({...pet,coat:$('pet-coat').value,collar:$('pet-collar').value});};
function renderCalendarEvent(event){
 const label=event.url?`<a href="${escape(event.url)}" target="_blank" rel="noopener noreferrer">${escape(event.title)} ↗</a>`:escape(event.title);
 return `<article class="task-row calendar-event"><div class="task-time">${timeLabel(event.start)}</div><div class="task-card"><span class="calendar-symbol" aria-hidden="true">▦</span><div class="task-content"><div class="task-title">${label}</div><div class="task-meta"><span>Google Calendar · ${event.busy?'Busy':'Free'}</span><span>until ${timeLabel(event.end)}</span>${!event.busy?'<span>Does not block tasks</span>':''}</div></div></div></article>`;
}
function renderCalendarStatus(){
 $('account-name').textContent=username;
 $('google-connect').hidden=calendar.connected&&!calendar.reconnect;
 $('google-connect').disabled=googleBusy||!calendar.ready;
 $('google-connect').textContent=calendar.reconnect?'Reconnect Google Calendar':'Connect Google Calendar';
 $('google-connected').hidden=!calendar.connected;
 $('google-refresh').disabled=googleBusy||calendar.loading;
 $('google-disconnect').disabled=googleBusy;
 $('google-status').textContent=calendar.loading?'Refreshing…':calendar.reconnect?'Connection expired. Reconnect to show events.':calendar.error||(!calendar.ready?'Google Calendar setup is not finished yet.':calendar.connected?'Connected':'');
 const eventCount=calendarRows(calendar.events,day,Intl.DateTimeFormat().resolvedOptions().timeZone).length;
 const updated=calendar.updated?new Date(calendar.updated).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
 $('google-detail').textContent=calendar.connected?`Primary calendar · ${eventCount} ${eventCount===1?'event':'events'} on this day${updated?` · Last refreshed ${updated}`:''}. Events refresh every five minutes while the planner is visible.`:'Connect to see your events alongside your tasks.';
 $('agenda-controls').hidden=!calendar.connected;
 $('agenda-zone').textContent=Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_',' ');
 $('calendar-status').hidden=!calendar.connected;
 $('calendar-status').dataset.state=calendar.error||calendar.reconnect?'attention':calendar.connected?'connected':'disconnected';
 $('calendar-manage').textContent=calendar.connected?'Google Calendar · Primary':'Google Calendar';
 $('calendar-status-text').textContent=calendar.reconnect?'Google Calendar needs reconnecting.':calendar.error?(calendar.updated?'Calendar couldn’t refresh. Showing the last update.':calendar.error):calendar.loading?'Loading Google Calendar…':calendar.connected?`${eventCount} ${eventCount===1?'event':'events'} · Updated ${updated||'just now'}`:calendar.ready?'Plan around your events':'Connection not configured';
 $('calendar-retry').textContent=calendar.reconnect?'Reconnect':calendar.connected?'Refresh':calendar.ready?'Connect':'Details';
 $('calendar-retry').disabled=calendar.loading||googleBusy;
}
async function loadCalendar(){
 if(!token||googleBusy)return;
 const sequence=++calendarSequence,requestedDay=day;
 lastCalendarAttempt=Date.now();calendar.loading=true;renderCalendarStatus();
 try{
  const status=await api('google/status');if(sequence!==calendarSequence)return;
  Object.assign(calendar,status);
  if(status.connected&&!status.reconnect){
   const query=new URLSearchParams({date:requestedDay,...calendarWindow(requestedDay)});
   const data=await api(`google/events?${query}`);if(sequence!==calendarSequence)return;
   Object.assign(calendar,data);if(data.reconnect||!data.connected){calendar.events=[];calendar.updated=null;}
  }else{calendar.events=[];calendar.updated=null;}
  calendar.error='';
 }catch(error){if(sequence!==calendarSequence)return;calendar.error=error.message;}
 finally{if(sequence===calendarSequence){calendar.loading=false;if(!$('workspace').hidden)render();else renderCalendarStatus();}}
}
function restoreDraft(){
 try{const draft=JSON.parse(sessionStorage.getItem('good-day-calendar-draft'));if(draft?.user===username&&draft.day===day){$('task-name').value=draft.name;$('duration').value=draft.minutes;$('group').value=draft.group;$('task-start').value=draft.start;$('task-time-details').open=!!draft.start;$('group-details').open=!!draft.group;sessionStorage.removeItem('good-day-calendar-draft');updateComposer();syncGroupColor();}}catch{}
}
async function openAccount(onboarding=false){
 $('onboarding-intro').hidden=onboarding!==true;$('onboarding-done').hidden=onboarding!==true;
 renderCalendarStatus();$('account-dialog').showModal();$('auto-rollover').disabled=true;$('settings-status').textContent='';
 try{const settings=await api('settings');$('auto-rollover').checked=settings.rollover;}catch(error){$('settings-status').textContent=error.message;}
 finally{$('auto-rollover').disabled=false;}
}
$('auto-rollover').onchange=async()=>{const enabled=$('auto-rollover').checked;$('auto-rollover').disabled=true;
 try{await api('settings','PUT',{rollover:enabled});$('settings-status').textContent='Saved.';}
 catch(error){$('auto-rollover').checked=!enabled;$('settings-status').textContent=error.message;}
 finally{$('auto-rollover').disabled=false;}
};
$('onboarding-done').onclick=()=>$('account-dialog').close();
$('account').onclick=openAccount;
$('calendar-manage').onclick=openAccount;
for(const button of document.querySelectorAll('[data-agenda]'))button.onclick=()=>{agendaView=button.dataset.agenda;render();document.querySelector('.schedule-scroll').scrollTop=0;};
$('close-account').onclick=()=>$('account-dialog').close();
$('google-connect').onclick=async()=>{
 googleBusy=true;renderCalendarStatus();
 try{
  const data=await api('google/connect','POST',{});
  const destination=new URL(data.url);if(destination.origin!=='https://accounts.google.com')throw new Error('Google could not be opened.');
  sessionStorage.setItem('good-day-calendar-draft',JSON.stringify({user:username,day,name:$('task-name').value,minutes:$('duration').value,group:$('group').value,start:$('task-start').value}));
  location.assign(destination.href);
 }catch(error){calendar.error=error.message;googleBusy=false;renderCalendarStatus();}
};
$('google-disconnect').onclick=async()=>{
 googleBusy=true;calendarSequence++;renderCalendarStatus();
 try{await api('google/disconnect','POST',{});calendar={...calendar,connected:false,reconnect:false,events:[],updated:null,error:'',loading:false};render();}
 catch(error){calendar.error=error.message;}
 finally{googleBusy=false;calendar.loading=false;renderCalendarStatus();}
};
$('google-refresh').onclick=()=>loadCalendar();
$('calendar-retry').onclick=()=>{if(calendar.reconnect||!calendar.connected)openAccount();else loadCalendar();};
setInterval(()=>{if(token&&calendar.connected&&!calendar.loading&&!document.hidden)loadCalendar();},300000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token&&calendar.connected&&!calendar.loading&&Date.now()-lastCalendarAttempt>60000)loadCalendar();});
async function refreshCare(){
 if(!token||careBusy||document.hidden||Date.now()-lastCareRefresh<30000)return;
 lastCareRefresh=Date.now();const currentToken=token;
 try{const data=await api(`care?zone=${zone()}`);if(token===currentToken){care=data.care;renderCare();}}catch{}
}
window.addEventListener('focus',refreshCare);
document.addEventListener('visibilitychange',refreshCare);
async function boot(){
 if(!token){showAuth();if(googleReturn.has('google-code'))notice('Log in, then connect Google Calendar again.');return;}
 // Restore the day before fetching its plan after the Google round trip.
 try{const draft=JSON.parse(sessionStorage.getItem('good-day-calendar-draft'));if(draft?.day)day=draft.day;}catch{}
 if(googleReturn.has('google-code')){
  try{await api('google/complete','POST',{code:googleReturn.get('google-code'),state:googleReturn.get('google-state')});notice('Google Calendar connected.');}
  catch(error){notice(error.message,true);}
 }else if(googleReturn.get('google-result')==='cancelled')notice('Calendar wasn’t connected.');
 if(token)await loadDay();
}
boot();
