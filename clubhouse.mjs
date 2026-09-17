import {companions,hourlyQuote} from './progression.mjs';
import {puppySVG} from './pet.mjs';
export function mountClubhouse({getState,serveMeal,savePet}){
 const dialog=document.createElement('dialog');dialog.id='clubhouse';dialog.className='clubhouse';
 dialog.innerHTML=`<div class="dialog-heading"><div><small>YOUR LITTLE COMPANION CLUB</small><h2>Room to grow.</h2></div><button type="button" data-close aria-label="Close companion club">✕</button></div>
 <p class="hourly-quote"></p><div class="club-stats"></div><p class="club-unlock"></p>
 <div class="club-pets" aria-label="Companion collection"></div>
 <div class="club-tabs" role="group" aria-label="Companion activities"><button data-tab="meal">Meal time</button><button data-tab="play">Play together</button><button data-tab="collection">Your companions</button></div>
 <section data-pane="meal"><div class="club-scene"><div class="club-pet"></div><div class="meal-bowl" aria-hidden="true">🥣</div></div><label>On the menu<select class="meal-choice"><option>Crunchy kibble</option><option>Garden bowl</option><option>Cozy stew</option></select></label><button class="primary" data-feed>Serve meal</button><p class="meal-hint"></p></section>
 <section data-pane="play" hidden><div class="play-yard"><div class="yard-pet"></div><button class="yard-ball" aria-label="Throw the ball">🎾</button></div><p>Tap the ball or use Tab and Enter to toss. A little break, together.</p><div class="club-tabs"><button data-pat>Give a pat</button><button data-trick="paw">Paw</button><button data-trick="spin">Spin</button><button data-trick="roll">Roll</button></div></section>
 <section data-pane="collection" hidden><p>Finish at least one task each day to grow your streak. Companions stay unlocked even after a break.</p><div class="collection-list"></div></section>
 <p class="club-feedback" role="status"></p><details class="club-sandbox" hidden><summary>Yash’s playground</summary><p>Try every companion, meal, and trick. Preview only: your tasks, streak, and earned care stay as they are.</p><label><input type="checkbox" class="sandbox-toggle"> Unlock all previews</label><div class="club-tabs"><button data-preview-care="walk">Try a walk</button><button data-preview-care="rest">Try bedtime</button></div></details>`;
 document.body.append(dialog);
 let preview=null,throws=0,tab='meal',feeding=false,adopting=false;
 const $=s=>dialog.querySelector(s),say=text=>$('.club-feedback').textContent=text;
 const sandbox=()=>getState().care?.playground&&$('.sandbox-toggle').checked;
 const activePet=()=>preview||getState().pet;
 function selectTab(next){tab=next;dialog.querySelectorAll('[data-pane]').forEach(el=>el.hidden=el.dataset.pane!==tab);dialog.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.tab===tab)));say('');}
 function render(){
  const {care}=getState(),p=care?.progress||{streak:0,best:0,xp:0,level:1,companions:['biscuit']};
  if(!care?.playground){$('.sandbox-toggle').checked=false;preview=null;}
  $('.hourly-quote').textContent=hourlyQuote();
  $('.club-stats').textContent=`${p.streak} day streak · Best ${p.best} · ${p.xp} XP · Level ${p.level}`;
  const next=companions.find(c=>!p.companions.includes(c.id));
  $('.club-unlock').textContent=next?`${next.name} joins at a ${next.days}-day streak. Every completed task earns 10 XP.`:'Your whole crew is here. Keep growing together.';
  $('.club-pets').innerHTML=companions.map(c=>`<span title="${c.name} · ${c.days} day streak" class="${p.companions.includes(c.id)||sandbox()?'':'locked'}">${puppySVG({...c,collar:'sage'})}</span>`).join('');
  $('.collection-list').innerHTML=companions.map(c=>`<button data-adopt="${c.id}" ${adopting||(!p.companions.includes(c.id)&&!sandbox())?'disabled':''}>${puppySVG({...c,collar:'sage'})}<span>${c.name}<small>${c.days?c.days+' day streak':'Your first friend'}${p.companions.includes(c.id)?' · Unlocked':''}</small></span></button>`).join('');
  $('.club-pet').innerHTML=puppySVG(activePet());$('.yard-pet').innerHTML=puppySVG(activePet());
  $('.club-sandbox').hidden=!care?.playground;
  const meal=care?.needs.find(n=>n.id==='meal');
  $('[data-feed]').disabled=feeding||(!sandbox()&&!meal?.ready);
  $('[data-feed]').textContent=sandbox()?'Preview meal':meal?.done?'Fed for today':'Serve meal';
  $('.meal-hint').textContent=sandbox()?'All meals are available to preview.':meal?.done?'A happy, full tummy. Come back tomorrow.':meal?.ready?'You earned this meal. Pick a bowl and serve it.':'Complete your first task today to unlock a meal.';
  dialog.querySelectorAll('[data-trick]').forEach(b=>b.disabled=!sandbox()&&!care?.tricks.includes(b.dataset.trick));
 }
 dialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
 $('[data-close]').onclick=()=>dialog.close();
 $('.sandbox-toggle').onchange=()=>{preview=null;render();say(sandbox()?'Playground on. All previews unlocked.':'Back to your earned progress.');};
 $('[data-feed]').onclick=async()=>{
  if(feeding)return;feeding=true;render();
  try{if(!sandbox()&&!await serveMeal()){say('Could not serve the meal. Please try again.');return;}$('.meal-bowl').textContent='✨';say(`${activePet().name} enjoyed ${$('.meal-choice').value.toLowerCase()}. Happy tummy!`);}
  finally{feeding=false;render();}
 };
 $('.yard-ball').onclick=()=>{throws++;const positions=[['72%','22%'],['15%','65%'],['64%','62%'],['20%','18%']],pos=positions[(throws-1)%4];$('.yard-ball').style.left=pos[0];$('.yard-ball').style.top=pos[1];$('.yard-pet').style.left=pos[0];say(`${activePet().name} brought it back! ${throws} ${throws===1?'toss':'tosses'} this visit.`);};
 $('[data-pat]').onclick=()=>say(`${activePet().name} leans into your hand. Best part of the day. ♥`);
 dialog.querySelectorAll('[data-trick]').forEach(b=>b.onclick=()=>{const el=$('.yard-pet');el.dataset.trick=b.dataset.trick;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate(b.dataset.trick==='paw'?[{transform:'rotate(0)'},{transform:'rotate(-18deg)'},{transform:'rotate(0)'}]:[{transform:'rotate(0)'},{transform:'rotate(360deg)'}],{duration:700});say(`${activePet().name} shows you ${b.dataset.trick}!`);});
 $('.collection-list').onclick=async event=>{const button=event.target.closest('[data-adopt]');if(!button||button.disabled||adopting)return;const chosen=companions.find(c=>c.id===button.dataset.adopt),{pet}=getState();const candidate={...pet,name:chosen.name,species:chosen.species,coat:chosen.coat};if(sandbox()){preview=candidate;render();say(`Previewing ${chosen.name}. Your saved companion has not changed.`);}else{adopting=true;render();const saved=await savePet(candidate);adopting=false;if(saved){preview=null;render();say(`${chosen.name} is your active companion. Your other friends stay in the collection.`);}else{say('Could not switch companions. Please try again.');render();}}};
 dialog.querySelectorAll('[data-preview-care]').forEach(button=>button.onclick=()=>{if(!getState().care?.playground)return;selectTab('play');say(button.dataset.previewCare==='walk'?`${activePet().name} is ready for a sniff and a game of fetch. Toss the ball!`:`${activePet().name} curls up for a cozy nap. Zzz…`);});
 dialog.addEventListener('close',()=>{preview=null;$('.sandbox-toggle').checked=false;});
 return {open(next='play'){throws=0;preview=null;$('.meal-bowl').textContent='🥣';render();selectTab(next);dialog.showModal();},render,close(){dialog.close();}};
}
