import {defaultPet, coats, collars} from './pet-profile.mjs';
import {personality,idleBehavior} from './care-model.mjs';
import {findPath,freePoint,petSize} from './pet-world.mjs';

// Self-contained vector puppy; no image downloads or animation library.
export function puppySVG(profile = defaultPet) {
  const {fur, ears, cream} = coats[profile.coat] || coats.honey;
  const collar = collars[profile.collar] || collars.sage;
  return `<svg class="puppy" viewBox="0 0 110 110" aria-hidden="true">
    <ellipse cx="55" cy="98" rx="31" ry="5" fill="#596246" opacity=".12"/>
    <g class="puppy-tail"><path d="M77 79 Q101 58 95 76 Q91 90 76 88" fill="${ears}" stroke="#645043" stroke-width="1.6"/></g>
    <g class="puppy-body"><path d="M36 67 Q27 80 35 94 Q53 102 77 94 Q83 80 70 67" fill="${fur}" stroke="#645043" stroke-width="1.6"/><ellipse cx="55" cy="83" rx="12" ry="13" fill="${cream}"/>
      <g class="puppy-foot left-foot"><path d="M33 88 Q23 100 35 101 L47 100 L46 88" fill="${fur}" stroke="#645043" stroke-width="1.6" stroke-linejoin="round"/></g><g class="puppy-foot right-foot"><path d="M64 88 L63 100 L77 101 Q86 98 75 87" fill="${fur}" stroke="#645043" stroke-width="1.6" stroke-linejoin="round"/></g></g>
    <g class="puppy-head">
      <path class="puppy-ears" d="M31 26 Q12 14 11 36 Q9 63 24 66 Q34 66 36 46 M77 26 Q95 13 99 37 Q103 61 88 66 Q77 68 75 46" fill="${ears}" stroke="#645043" stroke-width="1.6"/>
      <path d="M29 25 Q53 11 79 26 Q88 40 82 61 Q78 77 55 79 Q30 78 24 61 Q19 42 29 25" fill="${fur}" stroke="#645043" stroke-width="1.6"/>
      <path d="M49 21 Q41 40 49 51 L61 51 Q68 37 61 21" fill="${cream}"/>
      <ellipse cx="54" cy="61" rx="22" ry="15" fill="${cream}"/>
      <g class="puppy-eyes"><g class="puppy-gaze"><ellipse cx="37" cy="48" rx="5.3" ry="6.5" fill="#3c332f"/><ellipse cx="72" cy="48" rx="5.3" ry="6.5" fill="#3c332f"/><circle cx="35.5" cy="45.5" r="1.8" fill="white"/><circle cx="70.5" cy="45.5" r="1.8" fill="white"/></g>
      </g><g class="puppy-smile-eyes" fill="none" stroke="#3c332f" stroke-width="2.6" stroke-linecap="round"><path d="M32 49 Q37 43 42 49 M67 49 Q72 43 77 49"/></g>
      <ellipse cx="29" cy="58" rx="6" ry="3" fill="#dc9290" opacity=".6"/><ellipse cx="80" cy="58" rx="6" ry="3" fill="#dc9290" opacity=".6"/>
      <path d="M48 56 Q54 53 60 56 Q60 62 54 63 Q48 62 48 56" fill="#3c332f"/><path d="M54 63 L54 66 M46 65 Q50 70 54 66 Q59 70 63 65" fill="none" stroke="#3c332f" stroke-width="1.6" stroke-linecap="round"/>
      <path class="puppy-tongue" d="M51 68 Q51 78 56 77 Q61 76 58 68" fill="#df8f96"/>
      <path d="M34 75 Q55 86 76 74" fill="none" stroke="${collar}" stroke-width="5"/><circle cx="55" cy="80" r="3.5" fill="#e6bf66"/>
    </g>
    <g class="puppy-curled"><path d="M24 88 Q18 64 48 62 Q75 52 88 75 Q99 96 69 100 L36 100 Q21 99 24 88" fill="${fur}" stroke="#645043" stroke-width="1.6"/><path d="M82 76 Q101 78 86 91 Q65 105 62 86" fill="${ears}" stroke="#645043" stroke-width="1.6"/><ellipse cx="40" cy="83" rx="20" ry="15" fill="${cream}"/><path d="M24 75 Q12 66 16 87 Q20 97 28 89" fill="${ears}"/><path d="M34 82 Q38 86 42 82" fill="none" stroke="#3c332f" stroke-width="2" stroke-linecap="round"/><ellipse cx="24" cy="87" rx="4" ry="3" fill="#3c332f"/><path d="M39 96 L54 96" stroke="${collar}" stroke-width="4" stroke-linecap="round"/></g>
    <g class="puppy-zzz" fill="#8a9878" font-size="9" font-family="sans-serif"><text x="63" y="52">z</text><text x="74" y="42" font-size="7">z</text></g>
  </svg>`;
}

export function createCompanion({onOpen}){
 const $=id=>document.getElementById(id),el=$('pet-wanderer'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let profile={...defaultPet},care=null,focused=false,sequence=0,animation=null,actionTimer,playing=false,playTimer,throws=0,travel=0,lastTrick=0;
 const bounds=()=>({width:innerWidth,height:innerHeight});
 const quiet=()=>reduce.matches||!profile.roaming||focused||document.hidden;
 const typing=()=>document.activeElement?.matches('input,textarea,select')||!!document.querySelector('dialog[open]');
 function obstacles(){return [...document.querySelectorAll('.auth-card,.brand,.header-actions,.heading h1,.date-control,.task-form,.task-row,.focus-card,.progress-card,.schedule-toolbar,#care-open,#care-summary,#care-needs,#care-next,#pet-toss,#pet-play-hint,#calendar-status')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect()).filter(r=>r.bottom>0&&r.top<innerHeight);}
 const point=()=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top};};
 const place=p=>{el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;};
 function stop(){travel++;if(animation){const p=point();animation.cancel();animation=null;place(p);}el.classList.remove('running');}
 function home(){const r=$('pet-home').getBoundingClientRect();return {x:r.left+Math.max(0,(r.width-petSize.width)/2),y:r.top+8};}
 function candidates(){return [home(),{x:8,y:innerHeight-84},{x:innerWidth-80,y:innerHeight-84},{x:innerWidth-80,y:100},{x:8,y:100}];}
 function settle(){const obs=obstacles();if(freePoint(point(),obs,bounds()))return;stop();const p=candidates().find(p=>freePoint(p,obs,bounds()));el.hidden=!p;if(p)place(p);}
 function react(action,text='',duration=2400){clearTimeout(actionTimer);el.dataset.action=focused?'sleep':action;$('pet-reaction').textContent=text;actionTimer=setTimeout(()=>{el.dataset.action=focused?'sleep':care?.used===7?'curl':'idle';$('pet-reaction').textContent='';},duration);}
 async function move(to){
  if(quiet()||typing())return false;settle();const path=findPath(point(),to,obstacles(),bounds());if(!path)return false;
  stop();const ticket=travel;el.classList.add('running');
  const distances=[0];for(let i=1;i<path.length;i++)distances.push(distances[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
  const length=distances.at(-1);if(length<1){el.classList.remove('running');return true;}
  animation=el.animate(path.map((p,i)=>({left:`${p.x}px`,top:`${p.y}px`,offset:distances[i]/length})),{duration:Math.max(350,Math.min(8000,length*7)),easing:'linear',fill:'forwards'});
  try{await animation.finished;if(ticket!==travel)return false;place(to);animation.cancel();animation=null;el.classList.remove('running');return true;}catch{return false;}
 }
 function endPlay(){if(playing)stop();playing=false;$('pet-play-controls').hidden=true;clearTimeout(playTimer);$('pet-toss').hidden=true;$('pet-play-hint').hidden=true;$('pet-world-ball').hidden=true;el.classList.remove('carrying');}
 async function toss(target){
  if(!playing||quiet()||animation)return;
  const obs=obstacles(),near=point(),dest=target||[...candidates().reverse(),{x:near.x-100,y:near.y},{x:near.x+100,y:near.y},{x:near.x,y:near.y+100}].find(p=>Math.hypot(p.x-near.x,p.y-near.y)>30&&freePoint(p,obs,bounds())&&findPath(near,p,obs,bounds()));
  if(!dest||!freePoint(dest,obs,bounds()))return;
  const ball=$('pet-world-ball');ball.style.left=`${dest.x+30}px`;ball.style.top=`${dest.y+60}px`;ball.hidden=false;
  if(await move(dest)&&playing){ball.hidden=true;el.classList.add('carrying');react('bow');await move(home());el.classList.remove('carrying');if(++throws>=3)endPlay();}
 }
 function inspectTask(id){if(quiet()||typing())return;const r=document.querySelector(`[data-complete="${CSS.escape(id)}"]`)?.closest('.task-row')?.getBoundingClientRect();if(!r)return;const target=[{x:r.left-80,y:r.top},{x:r.right+8,y:r.top}].find(p=>freePoint(p,obstacles(),bounds()));if(target)move(target).then(ok=>{if(ok)react('sniff');});}
 $('pet-button').onclick=onOpen;$('pet-toss').onclick=()=>toss();
 document.addEventListener('pointermove',event=>{if(quiet()||typing())return;const r=el.getBoundingClientRect();el.style.setProperty('--gaze-x',`${Math.max(-2,Math.min(2,(event.clientX-r.x)/150))}px`);el.style.setProperty('--gaze-y',`${Math.max(-1,Math.min(1,(event.clientY-r.y)/150))}px`);},{passive:true});
 document.addEventListener('click',event=>{if(playing&&!event.target.closest('button,a,input,textarea,select,dialog,.task-row,.task-form,.care-card'))toss({x:event.clientX-36,y:event.clientY-60});});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')endPlay();});
 document.addEventListener('focusin',()=>{if(typing())stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();endPlay();}else{settle();if(!quiet())react('greet');}});
 for(const event of ['resize','scroll'])window.addEventListener(event,()=>{stop();settle();},{passive:true});
 reduce.addEventListener('change',()=>{stop();endPlay();el.classList.toggle('motion-quiet',quiet());});
 setInterval(()=>{if(quiet()||typing()||playing||animation)return;const behavior=idleBehavior({care,sequence:++sequence,character:personality(profile.name)});if(['bowl','curl','yawn'].includes(behavior))move(home()).then(ok=>{if(ok)react(behavior==='bowl'?'sniff':behavior);});else if(behavior==='explore'||sequence%3===1){const options=candidates();move(options[sequence%options.length]).then(ok=>{if(ok)react(behavior);});}else react(behavior);},14000);
 place({x:8,y:innerHeight-84});settle();
 return {
  setProfile(next){profile={...defaultPet,...next};$('pet-sprite').innerHTML=puppySVG(profile);$('pet-avatar').innerHTML=puppySVG(profile);$('pet-menu-name').textContent=profile.name;$('pet-dialog-name').textContent=profile.name;$('pet-button').ariaLabel=`Visit ${profile.name}`;el.classList.toggle('motion-quiet',quiet());if(quiet()){stop();endPlay();}settle();},
  setCare(next){const first=!care&&next;care=next;if(care?.used===7&&!focused&&!playing)el.dataset.action='curl';if(first&&freePoint(home(),obstacles(),bounds())){stop();place(home());}$('pet-home').dataset.used=String(care?.used||0);},
  setProgress(done){el.dataset.happy=String(done>0);},
  setFocus(value){if(focused===value)return;focused=value;stop();endPlay();el.classList.toggle('motion-quiet',quiet());react(value?'sleep':'stretch','',value?86400000:2400);},
  settle,taskAdded:inspectTask,taskCompleted(id){inspectTask(id);react('greet','✓',1800);},
  async performCare(action){endPlay();stop();await move(home());react({meal:'eat',walk:'bow',rest:'curl'}[action],{meal:'Dinner!',walk:'Sniff & fetch',rest:'Zzz'}[action],4000);if(action==='walk'&&!quiet()){playing=true;$('pet-play-controls').hidden=false;throws=0;$('pet-toss').hidden=false;$('pet-play-hint').hidden=false;playTimer=setTimeout(endPlay,45000);}},
  call(){move(home()).then(()=>react('greet'));},
  trick(){if(!care?.tricks.length||Date.now()-lastTrick<6000)return;lastTrick=Date.now();react(care.tricks[sequence++%care.tricks.length]);},
 };
}
