// Move the existing controls, preserving their values and event handlers.
const $=id=>document.getElementById(id);
const roomy=matchMedia('(min-width:1100px) and (min-height:740px)');
const narrow=matchMedia('(max-width:699px)');
const form=$('task-form'),timer=$('focus');
const formAnchor=document.createComment('task entry'),timerAnchor=document.createComment('timer');
form.before(formAnchor);timer.before(timerAnchor);
function adapt(){
 $('composer-dialog').close();$('timer-dialog').close();
 if(roomy.matches)formAnchor.after(form);else $('composer-dialog').append(form);
 if(narrow.matches)$('timer-dialog').append(timer);else timerAnchor.after(timer);
 $('open-composer').hidden=roomy.matches;
}
$('open-composer').onclick=()=>{$('composer-dialog').showModal();$('task-name').focus();};
$('close-composer').onclick=()=>$('composer-dialog').close();
$('close-timer').onclick=()=>$('timer-dialog').close();
function revealTimer(){if(narrow.matches){$('timer-dialog').showModal();$('timer-toggle').focus({preventScroll:true});}}
$('open-timer').addEventListener('click',revealTimer);
$('timeline').addEventListener('click',event=>{if(event.target.closest('[data-focus]'))revealTimer();});
new MutationObserver(()=>{if($('workspace').hidden){$('composer-dialog').close();$('timer-dialog').close();}}).observe($('workspace'),{attributes:true,attributeFilter:['hidden']});
roomy.addEventListener('change',adapt);narrow.addEventListener('change',adapt);adapt();
